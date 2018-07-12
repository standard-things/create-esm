import Module from "module"

import execa from "execa"
import fs from "fs"
import path from "path"

const isWin = process.platform === "win32"

// The `paths` option was added in Node 8.9.0.
// https://nodejs.org/dist/latest/docs/api/modules.html#modules_require_resolve_request_options
const nodeVersion = (String(process.version) + ".9.9")
  .match(/\d+/g)
  .slice(0, 3)
  .map(Number)

const useResolveFallback =
  nodeVersion[0] < 8 ||
  (nodeVersion[0] === 8 &&
   nodeVersion[1] < 9)

const mainFieldRegExp = /^(\s*)("main":.*?)(,)?(\r?\n)/m

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

  const cjsMainField = pkgJSON.main || "index.js"
  const cjsMainPath = resolve(cjsMainField)
  const cjsMainName = path.basename(cjsMainPath)
  const cjsMainDirname = path.dirname(cjsMainPath)

  const esmMainName = (cjsMainName === "main.js" ? "_" : "") + "main.js"
  const esmMainField = cjsMainField.slice(0, -cjsMainName.length) + esmMainName
  const esmMainPath = path.resolve(cjsMainDirname, esmMainName)

  const newPkgString = pkgString
    .replace(mainFieldRegExp, (match, prelude, main, comma = "", newline) => {
      const lines = [prelude + main]

      if (! Reflect.has(pkgJSON, "module")) {
        lines.push(prelude + '"module": ' + JSON.stringify(esmMainField))
      }

      return lines.join("," + newline) + comma + newline
    })

  if (newPkgString !== pkgString) {
    fs.writeFileSync(pkgPath, newPkgString)
  }

  if (fs.existsSync(cjsMainPath) ||
      fs.existsSync(esmMainPath)) {
    return
  }

  mkdirp(cjsMainDirname)

  fs.writeFileSync(cjsMainPath, [
    "// Set options as a parameter, environment variable, or rc file.",
    'require = require("esm")(module/*, options*/)',
    "module.exports = require(" + JSON.stringify("./" + esmMainName) + ")",
    ""
  ].join("\n"))

  fs.writeFileSync(esmMainPath, [
    "// ESM syntax is supported.",
    "export {}",
    ""
  ].join("\n"))
}

function initPackage(bin) {
  const initArgs = process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("-"))

  const binArgs = [
    "init",
    ...initArgs
  ]

  return execa(bin, binArgs, {
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
  if (useResolveFallback) {
    return resolveFallback(request)
  }

  try {
    return __non_webpack_require__.resolve(request, {
      paths: ["."]
    })
  } catch (e) {}

  return path.resolve(request)
}

function resolveFallback(request) {
  const fakeParent = new Module("", null)

  fakeParent.paths = Module._nodeModulePaths(".")

  const paths = Module._resolveLookupPaths(request, fakeParent)[1]
  const index = paths.indexOf(".")

  if (index) {
    if (index !== -1) {
      paths.splice(index, 1)
    }

    paths.unshift(".")
  }

  return Module._findPath(request, paths) ||
    path.resolve(request)
}

const bin = findBin()

Promise
  .resolve()
  // Add a newline to stdout between the create-esm installation and
  // the package initialization.
  // eslint-disable-next-line no-console
  .then(() => console.log(""))
  .then(() => initPackage(bin))
  .then(() => addESM(bin))
  .then(initFiles)
  .catch(console.error)
