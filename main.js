import Module from "module"

import fleece from "golden-fleece"
import fs from "fs-extra"
import path from "path"
import { shell } from "execa"

const shellOptions = {
  __proto__: null,
  stdio: "inherit"
}

Promise
  .resolve()
  .then(() => shell("npm init", shellOptions))
  .then(() => shell("npm i --save esm", shellOptions))
  .then(() => {
    const pkgPath = path.resolve("package.json")

    if (! fs.pathExistsSync(pkgPath)) {
      return
    }

    const pkgString = fs.readFileSync(pkgPath, "utf8")
    const pkgJSON = JSON.parse(pkgString)
    const main = pkgJSON.main || "index.js"
    const mainPath = require.resolve(main, { paths: ["."] })

    let relPath = path.relative(process.cwd(), mainPath)

    if (relPath.charCodeAt(0) !== 46 /* . */) {
      relPath = "." + path.sep + relPath
    }

    const newMainName = "_" + path.basename(mainPath)
    const newMainPath = path.resolve(path.dirname(mainPath), newMainName)
    const newMain = path.join(path.dirname(relPath), newMainName)

    fs.writeFileSync(pkgPath, fleece.patch(pkgString, Object.assign({
      main: newMain
    }, pkgJSON)))

    if (! fs.pathExistsSync(newMainPath)) {
      fs.writeFileSync(newMainPath, [
        '"use strict"',
        "",
        'require = require("esm")(module)',
        'module.export = require("' + relPath + '")',
        ''
      ].join("\n"))
    }
})
