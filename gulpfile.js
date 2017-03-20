const gulp = require('gulp');
const rmdir = require('rimraf');
const sort = require('gulp-sort');
const mocha = require('gulp-mocha');
const ts = require('gulp-typescript');
const append = require('gulp-append');
const transform = require('gulp-transform');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify-harmony');

const preamble = '/** RavenDB Client - (c) Hibernating Rhinos 2017 */';
const exportDefault = 'export default DocumentStore;';
const prioritizedClasses = ['Hash.ts', 'RavenCommand.ts'];
const options = {
    src: './src',
    tests: './test',
    tmp: './.build',
    dest: './lib',
};

//@see https://github.com/IdanHaim/RavenDB-Python-Client/commit/267c178fa4ec5e9855028bfb80ed672d3d031b5e

gulp.task('clean', (next) => rmdir(options.tmp, next));

gulp.task('build:tests', ['clean'], () => gulp
    .src([
        options.tests + '/**/*Test.ts',
        options.src + '/[A-Z]*/**/*.ts'
    ], {
        base: __dirname
    })
    .pipe(ts({
        target: 'ES6',
        module: 'commonjs',
        removeComments: true
    }))
    .pipe(gulp.dest(options.tmp))
);

gulp.task('run:tests', ['clean', 'build:tests'], (next) => gulp
    .src(options.tmp + '/test/**/*Test.js')
    .pipe(mocha())
);

gulp.task('build:exports', ['clean'], () => gulp
    .src(options.src + '/ravendb-node.ts')
    .pipe(transform(contents => preamble + "\n"
        + contents
            .toString()
            .split('\n')
            .filter(line => !line.startsWith('import'))
            .map(line => line.replace(/ from.*;/, ';'))
            .join('\n')
        + "\n\n" + exportDefault + "\n"
    ))
    .pipe(gulp.dest(options.tmp))
);

gulp.task('build:concat', ['clean'], () => gulp
    .src(options.src + '/[A-Z]*/**/*.ts')
    .pipe(sort({
        comparator: (file, anotherFile) => {
            const isPrioritized = (file) => prioritizedClasses
                .some((className) => !!~file.path.indexOf(className));

            return isPrioritized(file) ? -1 : (
                isPrioritized(anotherFile) ? 1 : 0
            );
        }
    }))
    .pipe(concat('ravendb-node.bundle.ts'))
    .pipe(transform(contents => contents
        .toString()
        .split('\n')
        .filter(line => !line.startsWith('import'))
        .map(line => line.replace(/export /, ''))
        .join('\n')
    ))
    .pipe(gulp.dest(options.tmp))
);

gulp.task('build:bundle', ['clean', 'build:exports', 'build:concat'], () => gulp
    .src([
        options.tmp + '/ravendb-node.ts',
        options.tmp + '/ravendb-node.bundle.ts'
    ])
    .pipe(concat('ravendb-node.ts'))
    .pipe(gulp.dest(options.tmp))
);

gulp.task('build:compile', ['clean', 'build:exports', 'build:concat', 'build:bundle'], () => gulp
    .src(options.tmp + '/ravendb-node.ts')
    .pipe(ts({
        target: 'ES6',
        module: 'commonjs',
        removeComments: true,
        declaration: true
    }))
    .pipe(gulp.dest(options.dest))
);

gulp.task('build:uglify', ['clean', 'build:exports', 'build:concat', 'build:bundle', 'build:compile'], () => gulp
    .src(options.dest + '/ravendb-node.js')
    .pipe(uglify({
        mangle: {
            sort: true,
            toplevel: true
        },
        output: {
            preamble: preamble
        }
    }))
    .pipe(gulp.dest(options.dest))
);

gulp.task('test', ['clean', 'build:tests', 'run:tests']);

gulp.task('bundle', ['clean', 'build:exports', 'build:concat', 'build:bundle', 'build:compile', 'build:uglify']);