const path = require("path")

module.exports =
{
	mode: "production",
	entry:
	{
		datasetSampleCreator: path.resolve(__dirname, "src/datasetSampleCreator.js"),
		recognizeComponentTest: path.resolve(__dirname, "src/recognizeComponentTest.js"),
	},
	
	output:
	{
		filename: "[name].bundle.js",
		path: path.resolve(__dirname, "public/bundle")
	},
	
	module:
	{
		rules:
		[
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use:
				{
					loader: "babel-loader",
					options: {
						presets: ["@babel/preset-env"]
					}
				}
			}
		]
	}
}