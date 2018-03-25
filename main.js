import execa from "execa"
import fs from "fs-extra"
import path from "path"

const { env } = process
const isWin = process.platform === "win32"

const npmBinRegExp = isWin
  ? /[\\/]npm(\.cmd)?$/
  : /\/npm$/

const npmJsRegExp = isWin
  ? /[\\/]node_modules[\\/]npm[\\/]bin[\\/]npm-cli\.js$/
  : /\/node_modules\/npm\/bin\/npm-cli\.js$/

const npxJsRegExp = isWin
  ? /[\\/]node_modules[\\/]npm[\\/]bin[\\/]npm-cli\.js$/
  : /\/node_modules\/npm\/bin\/npm-cli\.js$/

const npxBinRegExp = isWin
  ? /[\\/]npx(\.cmd)?$/
  : /\/npx$/

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
  let bin = "yarn"

  if (npmJsRegExp.test(env.NPM_CLI_JS) ||
      npxJsRegExp.test(env.NPX_CLI_JS) ||
      npmBinRegExp.test(env._) ||
      npxBinRegExp.test(env._)) {
    bin = "npm"
  }

  if (! checkBin(bin)) {
    bin = bin === "yarn" ? "npm" : "yarn"

    if (! checkBin(bin)) {
      throw new Error("No package manager found.")
    }
  }

  return bin
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
    'require = require("esm")(module)',
    'module.export = require("./' + esmMainName + '")',
    ""
  ].join("\n"))

  fs.outputFileSync(esmMainPath, [
    "export {}",
    ""
  ].join("\n"))
}

const bin = findBin()

Promise
  .resolve()
  .then(() => initPackage(bin))
  .then(() => addESM(bin))
  .then(() => writeFiles())
  .catch((e) => console.error(e))
