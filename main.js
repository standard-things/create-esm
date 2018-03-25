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

let bin = "yarn"

function tryResolve(request) {
  try {
    return require.resolve(request, { paths: ["."] })
  } catch (e) {}

  return path.resolve(request)
}

Promise
  .resolve()
  .then(() => {
    if (npmJsRegExp.test(env.NPM_CLI_JS) ||
        npxJsRegExp.test(env.NPX_CLI_JS) ||
        npmBinRegExp.test(env._) ||
        npxBinRegExp.test(env._)) {
      bin = "npm"
    }

    return execa(bin, ["-v"], {
      reject: false
    })
  })
  .then((result) => {
    const args = [
      "init",
      ...process.argv.slice(2)
    ]

    if (result.failed) {
      bin = bin === "npm" ? "yarn" : "npm"
    }

    return execa(bin, args, {
      stdio: "inherit"
    })
  })
  .then(() => {
    const args = bin === "npm"
      ? ["i", "--save", "esm"]
      : ["add", "esm"]

    return execa(bin, args, {
      stdio: "inherit"
    })
  })
  .then(() => {
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
  })
