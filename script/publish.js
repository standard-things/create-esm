"use strict"

const execa = require("execa")
const fleece = require("golden-fleece")
const fs = require("fs-extra")
const path = require("path")

const rootPath = path.resolve(__dirname, "..")
const pkgPath = path.resolve(rootPath, "package.json")

const defaultScripts = {
  test: 'echo "Error: no test specified" && exit 1'
}

const fieldsToRemove = [
  "devDependencies",
  "private"
]

function cleanPackageJSON() {
  const content = fs.readFileSync(pkgPath, "utf8")
  process.once("exit", () => fs.writeFileSync(pkgPath, content))

  const pkgJSON = JSON.parse(content)
  pkgJSON.scripts = defaultScripts
  fieldsToRemove.forEach((field) => Reflect.deleteProperty(pkgJSON, field))
  fs.writeFileSync(pkgPath, fleece.patch(content, pkgJSON))
}

function publishPackage() {
  return execa("npm", ["publish"], {
    cwd: rootPath,
    stdio: "inherit"
  })
}

Promise
  .resolve()
  .then(cleanPackageJSON)
  .then(publishPackage)
  .catch(console.error)
