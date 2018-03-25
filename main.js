import execa from "execa"
import fleece from "golden-fleece"
import fs from "fs"
import path from "path"

const { env } = process
const isWin = process.platform === "win32"

const backSlashRegExp = /\\/g

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

function normalize(filename) {
  return filename.replace(backSlashRegExp, "/")
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
    if (result.failed) {
      bin = bin === "npm" ? "yarn" : "npm"
    }

    return execa(bin, ["init"], {
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

    if (! fs.existsSync(pkgPath)) {
      return
    }

    const pkgString = fs.readFileSync(pkgPath, "utf8")
    const pkgJSON = JSON.parse(pkgString)

    const main = pkgJSON.main || "index.js"
    const mainPath = require.resolve(main, { paths: ["."] })
    const mainName = path.basename(mainPath)

    const newMainName = mainName === "main.js"
      ? "_" + mainName
      : mainName

    const newMainPath = path.resolve(path.dirname(mainPath), newMainName)

    if (fs.existsSync(newMainPath)) {
      return
    }

    let relPath = path.relative(process.cwd(), mainPath)

    if (relPath.charCodeAt(0) !== 46 /* . */) {
      relPath = "./" + relPath
    }

    const newMain = path.resolve(path.dirname(relPath), newMainName)

    fs.writeFileSync(pkgPath, fleece.patch(pkgString, Object.assign({
      main: normalize(newMain)
    }, pkgJSON)))

    fs.writeFileSync(newMainPath, [
      '"use strict"',
      "",
      'require = require("esm")(module)',
      'module.export = require("' + normalize(relPath) + '")',
      ""
    ].join("\n"))
  })
