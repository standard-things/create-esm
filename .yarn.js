"use strict"

const child_process = require("child_process")

const args = process.argv.slice(2)

const flagsWithArgs = new Set([
  "--cache-folder",
  "--cwd",
  "--emoji",
  "--global-folder",
  "--https-proxy",
  "--link-folder",
  "--modules-folder",
  "--mutex",
  "--network-concurrency",
  "--network-timeout",
  "--preferred-cache-folder",
  "--prod",
  "--production",
  "--proxy",
  "--registry",
  "--scripts-prepend-node-path",
  "--use-yarnrc"
])

const doubleDashIndex = args.findIndex((arg) => arg === "--")

const possibleArgs = doubleDashIndex === -1
  ? args
  : args.slice(0, doubleDashIndex)

const firstNonFlagIndex = possibleArgs.findIndex((arg, index) => {
  const prev = index ? args[index - 1] : void 0

  return ! arg.startsWith("-") &&
    ! flagsWithArgs.has(prev)
})

child_process.spawn("yarn", ["-v"])
  .stdout.on("data", (data) => {
    if (firstNonFlagIndex !== -1 &&
        args[firstNonFlagIndex] === "node") {
      const version = data.toString().trim()
      const [major, minor] = version.split(".").map(Number)

      let spliceArgs = []

      if (major < 1 ||
          (major === 1 &&
          minor < 11)) {
        spliceArgs.push("--")
      }

      spliceArgs.push("-r", "esm")
      args.splice(firstNonFlagIndex + 1, 0, ...spliceArgs)
    }

    child_process.spawn("yarn", args, {
      stdio: "inherit"
    })
  })
