const path = require("path");

module.exports = (_env, argv) => ({
  mode: "development",
  plugins: [new (require('webpack').DefinePlugin)({
    __LOCAL_FIREBASE__: JSON.stringify(process.env.FIREBASE_EMULATORS === '1'),
  })],
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  entry: {
    'main': './src/main.ts',
    'choose': './src/choose.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist")
  }
});
