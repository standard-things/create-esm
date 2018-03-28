import execa from "execa"
import fs from "fs"
import path from "path"

const isWin = process.platform === "win32"

const npmBinRegExp = isWin
  ? /[\\/]np[mx](\.cmd)?$/
  : /\/np[mx]$/

const npmJsRegExp = isWin
  ? /[\\/]node_modules[\\/]npm[\\/]bin[\\/]np[mx]-cli\.js$/
  : /\/node_modules\/npm\/bin\/np[mx]-cli\.js$/

function addESM(bin) {
  const args = bin === "yarn"
    ? ["add", "esm"]
    : ["i", "--save", "esm"]

  return execa(bin, args)
}

function checkBin(bin) {
  return ! execa.sync(bin, ["-v"], {
    reject: false
  }).failed
}

function findBin() {
  const { env } = process

  let bin = "yarn"

  if (npmJsRegExp.test(env.NPM_CLI_JS) ||
      npmJsRegExp.test(env.NPX_CLI_JS) ||
      npmBinRegExp.test(env._)) {
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

function initFiles() {
  const pkgPath = path.resolve("package.json")

  if (! fs.existsSync(pkgPath)) {
    return
  }

  const pkgString = fs.readFileSync(pkgPath, "utf8")
  const pkgJSON = JSON.parse(pkgString)

  const main = pkgJSON.main || "index.js"
  const mainPath = resolve(main)
  const mainName = path.basename(mainPath)
  const mainDirname = path.dirname(mainPath)

  const esmMainName = mainName === "main.js"
    ? "_" + mainName
    : "main.js"

  const esmMainPath = path.resolve(mainDirname, esmMainName)

  if (fs.existsSync(mainPath) ||
      fs.existsSync(esmMainPath)) {
    return
  }

  mkdirp(mainDirname)

  fs.writeFileSync(mainPath, [
    '"use strict"',
    "",
    "// Set options as a parameter, environment variable, or rc file.",
    'require = require("esm")(module/*, options*/)',
    'module.export = require("./' + esmMainName + '")',
    ""
  ].join("\n"))

  fs.writeFileSync(esmMainPath, [
    "export {}",
    ""
  ].join("\n"))
}

function initPackage(bin) {
  const args = [
    "init",
    ...process.argv.slice(2)
  ]

  return execa(bin, args, {
    stdio: "inherit"
  })
}

function mkdirp(dirPath) {
  const paths = []

  while (true) {
    if (fs.existsSync(dirPath) &&
        fs.statSync(dirPath).isDirectory()) {
      break
    }

    paths.push(dirPath)

    const parentPath = path.dirname(dirPath)

    if (dirPath === parentPath) {
      break
    }

    dirPath = parentPath
  }

  let { length } = paths

  while (length--) {
    fs.mkdirSync(paths[length])
  }

  return true
}

function resolve(request) {
  try {
    return require.resolve(request, {
      paths: ["."]
    })
  } catch (e) {}

  return path.resolve(request)
}

const bin = findBin()

Promise
  .resolve()
  // Add a newline to stdout between the create-esm installation and
  // the package initialization.
  /* eslint-disable no-console */
  .then(() => console.log(""))
  .then(() => initPackage(bin))
  .then(() => addESM(bin))
  .then(initFiles)
  .catch(console.error)
