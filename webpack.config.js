const glob = require("glob");
const fs = require("fs");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const posthtml = require("posthtml");
const { parse } = require("path");
const posthtmlCollectStylesPlugin = require("posthtml-collect-styles")("style")

// srcディレクトリと拡張子を消す
// ex: ./src/index.html -> ./index
const arrangePath = (fullPath) => {
  const removedExtension = fullPath.match(/(.+\/.+?).[a-z]+([?#;].*)?$/)[1];
  const removedSrcDir = removedExtension.replace(/src\//, "");
  return removedSrcDir;
}

// src配下の全てのejsパスを取得する
const getAllEjs = () => {
  const ejsList = glob.sync("./src/**/[!_]*.ejs");
  return ejsList;
}

// src配下の全てのejsを、ejsからhtmlに変換するプラグインを作成する
const getHtmlPlugins = () => {
  const ejsList = getAllEjs();
  const htmlWebpackPlugins = ejsList.map((v) => {
    return new HtmlWebpackPlugin({
      filename: arrangePath(v) + ".html",
      template: v,
      minify: true
    })
  })
  return htmlWebpackPlugins;
}


module.exports = {
  entry: getAllEjs(),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ejs$/,
        use: [
          {
            loader: "html-loader",
            options: {
              // copy-webpack-pluginでpublicをまるごとコピーするためcss, js以外の名前解決は行わない
              sources: {
                urlFilter: (attribute, value, resourcePath) => {
                  if (/\.(scss|sass|css)$/.test(value)) {
                    return true;
                  }
                  if (/\.(js)$/.test(value)) {
                    return true;
                  }
                  return false;
                },
              },
              // cssのすべてのインポート位置をheadに移す
              preprocessor: (content, loaderContext) => {
                let result;
                try {
                  result = posthtml().use(posthtmlCollectStylesPlugin).process(content, { sync: true });
                } catch (error) {
                  loaderContext.emitError(error);

                  return content;
                }

                return result.html;
              },
            },
          },
          {

            loader: "template-ejs-loader",
            options: {
              includer: (originalPath, parsedPath) => {
                let filename = "";
                if (/^\./.test(originalPath)) {
                  // includeでパスが'.'から始まる場合
                  filename = parsedPath;
                } else if (/^\//.test(originalPath)) {
                  // includeでパスが'/'から始まる場合
                  filename = path.resolve(__dirname, "src", "." + originalPath);
                } else {
                  console.log(originalPath, parsedPath);
                  filename = path.resolve(__dirname, "src", originalPath);
                }

                if (filename && fs.existsSync(filename)) {
                  return { filename };
                }
                // ファイルが存在しない場合
                throw new Error("Not Found: could not resolve " + originalPath);
              }
            }
          }
        ],
      },
      {
        test: /\.(scss|sass|css)$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
      },
    ],
  },
  resolve: {
    modules: [path.resolve(__dirname, "node_modules"), path.resolve(__dirname, "src")],
    roots: [path.resolve(__dirname, "src")]
  },
  plugins: [
    // webpackの仕様上, 余計なjsファイルが生まれるので削除
    new RemoveEmptyScriptsPlugin({
      extensions: /\.(css|scss|sass|less|styl|ejs|html)([?].*)?$/,
      remove: /main\.(js|mjs)$/
    }),
    // htmlをdistに出力
    ...getHtmlPlugins(),
    // cssをdistに出力
    new MiniCssExtractPlugin({
      filename: "[contenthash].css"
    }),
    // publicフォルダーをdistにコピー
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, "src/public"), to: path.resolve(__dirname, "dist/public") },
      ],
    }),
  ],
};
