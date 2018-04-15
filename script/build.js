"use strict"

const execa = require("execa")
const fs = require("fs-extra")
const path = require("path")
const trash = require("./trash.js")

const argv = require("yargs")
  .boolean("prod")
  .argv

const NODE_ENV = argv.prod ? "production" : "development"

const rootPath = path.resolve(__dirname, "..")
const buildPath = path.resolve(rootPath, "build")
const binPath = path.resolve(rootPath, "create-esm")

const webpackArgs = [
  argv.prod
    ? "--display-optimization-bailout"
    : "--hide-modules"
]

const trashPaths = [
  buildPath,
  binPath
]

function addShebang() {
  const content = [
    "#!/usr/bin/env node",
    '"use strict"\n',
    fs.readFileSync(binPath)
  ].join("\n")

  return fs.writeFile(binPath, content)
}

function cleanRepo() {
  return Promise.all(trashPaths.map(trash))
}

function copyBundle() {
  const srcPath = path.resolve(buildPath, "create-esm.js")

  return fs.pathExistsSync(srcPath)
    ? fs.copy(srcPath, binPath)
    : Promise.resolve()
}

function makeBundle() {
  return execa("webpack", webpackArgs, {
    cwd: rootPath,
    env: { NODE_ENV },
    stdio: "inherit"
  })
}

Promise
  .resolve()
  .then(cleanRepo)
  .then(makeBundle)
  .then(copyBundle)
  .then(addShebang)
  .catch(console.error)
