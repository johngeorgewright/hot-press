# Contributing to Hot Press

## Developing

It's easiest to use Node v6. If you have nvm install, simply run `nvm use` from
within the project directory to switch to the correct version.

If you must use Node v4, please make sure to change the test scripts to include
the `--harmony` flag.

Run the tests with `npm test`. If you would like to run tests every time a file
a file is changed, run `npm run spec-w`.

## Coding Style

We've added configuration for eslint and editorconfig.

Most editors these days have the ability to read an `.editorconfig` file. If
not, we use 2 space indentation and a final new line.

If your editor can't read and understand eslint configuration, you can lint your
files by running `npm run lint`. If you would like to keep running and checking
your files as you change them, run `npm i -g nodemon && npm run lint-w`.

## Git Commit Styleguide

Refer to [atom's guidelines](https://github.com/atom/atom/blob/master/CONTRIBUTING.md#git-commit-messages)

## Submitting changes

1. Fork the project
1. Create a branch with your changes
1. Please make sure your changes are covered by tests
1. Submit a pull request and we can start the merging process
