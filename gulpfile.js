var del = require('del');
var gulp = require('gulp');
var coffee = require('gulp-coffee');
var jshint = require('gulp-jshint');
var coffeelint = require('gulp-coffeelint');

gulp.task('clean', function () {
//    return del('./bin');
});

gulp.task('build', ['clean'] , function() {
    gulp.src('./src/www/**/*')
        .pipe(gulp.dest('./bin/www'));
    gulp.src('./src/**/*.coffee')
        .pipe(coffee())
        .pipe(gulp.dest('./bin'));
});

gulp.task('lint', function () {
    gulp.src('./src/**/*.coffee')
        .pipe(coffeelint({
            "indentation": {
                "value": 4
            },
            "max_line_length": {
                "level": "ignore"
            },
            "no_trailing_whitespace": {
                "level": "ignore"
            }
        }))
        .pipe(coffeelint.reporter())
    gulp.src(['./src/www/js/authjax.js', './src/www/js/index.js'])
        .pipe(jshint())
        .pipe(jshint.reporter())
});

gulp.task('default', ['clean', 'lint', 'build'])
