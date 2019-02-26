/* eslint strict: off, node/no-unsupported-features: ["error", { version: 6 }] */
"use strict"

const fs = require("fs-extra")
const path = require("path")
const webpack = require("webpack")

const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
const { EnvironmentPlugin } = webpack
const OptimizeJsPlugin = require("optimize-js-plugin")
const TerserPlugin = require("terser-webpack-plugin")
const UnusedPlugin = require("unused-webpack-plugin")

const isProd = /production/.test(process.env.NODE_ENV)

const terserOptions = fs.readJSONSync("./.terserrc")

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
  node: false,
  optimization: {
    minimizer: [
      new TerserPlugin({ terserOptions })
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
    }),
    new UnusedPlugin({
      directories : [path.resolve("src")],
      exclude: [
        ".*",
        "*.json"
      ],
      root : __dirname
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
