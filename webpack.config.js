/* eslint strict: off, node/no-unsupported-features: ["error", { version: 6 }] */
"use strict"

const JSON6 = require("json-6")

const fs = require("fs")
const path = require("path")
const webpack = require("webpack")

const readJSON = (filename) => JSON6.parse(fs.readFileSync(filename))

const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
const { EnvironmentPlugin } = webpack
const OptimizeJsPlugin = require("optimize-js-plugin")
const UglifyJSPlugin = require("uglifyjs-webpack-plugin")

const isProd = /production/.test(process.env.NODE_ENV)

const uglifyOptions = readJSON("./.uglifyrc")

/* eslint-disable sort-keys */
const config = {
  devtool: false,
  entry: {
    "create-esm": "./src/create-esm.js"
  },
  output: {
    filename: "[name].js",
    libraryExport: "default",
    libraryTarget: "commonjs2",
    path: path.resolve("build"),
    pathinfo: false
  },
  mode: isProd ? "production" : "development",
  module: {
    rules: [
      {
        loader: "babel-loader",
        test: /\.js$/,
        type: "javascript/auto"
      }
    ]
  },
  optimization: {
    minimizer: [
      new UglifyJSPlugin({ uglifyOptions })
    ],
    nodeEnv: false
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      defaultSizes: "gzip",
      logLevel: "silent",
      openAnalyzer: false,
      reportFilename: "report.html"
    })
  ],
  target: "node"
}
/* eslint-enable sort-keys */

if (isProd) {
  config.plugins.push(
    new OptimizeJsPlugin,
    new EnvironmentPlugin({ NODE_DEBUG: false })
  )
}

module.exports = config
