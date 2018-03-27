import execa from "execa"
import fs from "fs-extra"
import path from "path"
import psList from "ps-list"

const isWin = process.platform === "win32"

const npmBinRegExp = isWin
  ? /[\\/]np[mx](\.cmd)?$/
  : /\/np[mx]$/

const npmJsRegExp = isWin
  ? /[\\/]node_modules[\\/]npm[\\/]bin[\\/]np[mx]-cli\.js$/
  : /\/node_modules\/npm\/bin\/np[mx]-cli\.js$/

const npmNameRegExp = /^np[mx]$/

function addESM(bin) {
  return execBin(bin,
    bin === "yarn"
      ? ["add", "esm"]
      : ["i", "--save", "esm"]
  )
}

function checkBin(bin) {
  return ! execa.sync(bin, ["-v"], {
    reject: false
  }).failed
}

function execBin(bin, args) {
  return execa(bin, args, {
    stdio: "inherit"
  })
}

function findBin() {
  return getProcesses()
    .then((processes) => {
      const { env } = process

      let bin = "yarn"

      if (npmJsRegExp.test(env.NPM_CLI_JS) ||
          npmJsRegExp.test(env.NPX_CLI_JS) ||
          npmBinRegExp.test(env._) ||
          processes.some(({ name }) => npmNameRegExp.test(name))) {
        bin = "npm"
      }

      if (! checkBin(bin)) {
        bin = bin === "yarn" ? "npm" : "yarn"

        if (! checkBin(bin)) {
          throw new Error("No package manager found.")
        }
      }

      return bin
    })
}

function getProcesses() {
  return isWin
    ? Promise.resolve([])
    : psList()
}

function initPackage(bin) {
  return execBin(bin, [
    "init",
    ...process.argv.slice(2)
  ])
}

function tryResolve(request) {
  try {
    return require.resolve(request, { paths: ["."] })
  } catch (e) {}

  return path.resolve(request)
}

function writeFiles() {
  const pkgPath = path.resolve("package.json")

  if (! fs.pathExistsSync(pkgPath)) {
    return
  }

  const pkgString = fs.readFileSync(pkgPath, "utf8")
  const pkgJSON = JSON.parse(pkgString)

  const main = pkgJSON.main || "index.js"
  const mainPath = tryResolve(main)
  const mainName = path.basename(mainPath)

  const esmMainName = mainName === "main.js"
    ? "_" + mainName
    : "main.js"

  const esmMainPath = path.resolve(path.dirname(mainPath), esmMainName)

  if (fs.pathExistsSync(mainPath) ||
      fs.pathExistsSync(esmMainPath)) {
    return
  }

  fs.outputFileSync(mainPath, [
    '"use strict"',
    "",
    "// Set options as a parameter, environment variable, or rc file.",
    'require = require("esm")(module/*, options*/)',
    'module.export = require("./' + esmMainName + '")',
    ""
  ].join("\n"))

  fs.outputFileSync(esmMainPath, [
    "export {}",
    ""
  ].join("\n"))
}

findBin()
  .then((bin) =>
    initPackage(bin)
      .then(() => addESM(bin))
      .then(writeFiles)
  )
  .catch(console.error)
