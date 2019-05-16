import { getPackageManager, install } from "pkg-install"

import Module from "module"
import SemVer from "semver"

import execa from "execa"
import fs from "fs"
import path from "path"

const useRequireResolveOptions = SemVer.satisfies(process.version, ">=8.9")

const mainFieldRegExp = /^(\s*)("main":.*?)(,)?(\r?\n)/m

function initFiles(pkgManager) {
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

  const dotYarnPath = path.resolve(".yarn.js")
  const dotYarnrcPath = path.resolve(".yarnrc")
  const fixturesPath = path.resolve(__dirname, "fixtures")

  const dotYarnContent = fs.readFileSync(path.resolve(fixturesPath, ".yarn.js"), "utf8")
  const dotYarnrcContent = fs.readFileSync(path.resolve(fixturesPath, ".yarnrc"), "utf8")
  const esmMainContent = fs.readFileSync(path.resolve(fixturesPath, "main.js"), "utf8")

  const cjsMainContent = fs
    .readFileSync(path.resolve(fixturesPath, "index.js"), "utf8")
    .replace('"${ESM_MAIN_NAME}"', () => JSON.stringify("./" + esmMainName))

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

  if (pkgManager === "yarn") {
    if (! fs.existsSync(dotYarnPath)) {
      fs.writeFileSync(dotYarnPath, dotYarnContent)
    }

    if (! fs.existsSync(dotYarnrcPath)) {
      fs.writeFileSync(dotYarnrcPath, dotYarnrcContent)
    }
  }

  if (fs.existsSync(cjsMainPath) ||
      fs.existsSync(esmMainPath)) {
    return
  }

  mkdirp(cjsMainDirname)

  fs.writeFileSync(cjsMainPath, cjsMainContent)
  fs.writeFileSync(esmMainPath, esmMainContent)
}

function initPackage(pkgManager) {
  const args = process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("-"))

  return execa(pkgManager, ["init", ...args], {
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
  if (useRequireResolveOptions) {
    try {
      return __non_webpack_require__.resolve(request, {
        paths: ["."]
      })
    } catch {}

    return path.resolve(request)
  }

  return resolveFallback(request)
}

function resolveFallback(request) {
  const fakeParent = new Module("", null)

  fakeParent.paths = Module._nodeModulePaths(".")

  const lookupPaths = Module._resolveLookupPaths(request, fakeParent)[1]
  const paths = []

  for (const lookupPath of lookupPaths) {
    if (paths.indexOf(lookupPath) === -1) {
      paths.push(lookupPath)
    }
  }

  const foundPath = Module._findPath(request, paths)

  return foundPath === false
    ? path.resolve(request)
    : foundPath
}

getPackageManager({})
  .then((pkgManager) =>
    Promise
      .resolve()
      // Add a newline to stdout between the create-esm installation and
      // the package initialization.
      // eslint-disable-next-line no-console
      .then(() => console.log(""))
      .then(() => initPackage(pkgManager))
      .then(() => install(["esm"]))
      .then(() => initFiles(pkgManager))
  )
  .catch(console.error)
