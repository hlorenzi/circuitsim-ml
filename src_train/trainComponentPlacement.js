import tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-node"

import fs from "fs"
import ImageFileUtils from "../src/imageFileUtils.js"
import * as Utils from "../src/utils.js"

const WINDOW_SIZE = 32
const WINDOW_STRIDE = 8


async function loadSample(filenamePrefix)
{
	console.log("loading sample " + filenamePrefix + "...")
	
	const imgIn = ImageFileUtils.loadFromFile(filenamePrefix + ".in.png")
	const imgOut = ImageFileUtils.loadFromFile(filenamePrefix + ".out.png")
	
	if (!imgIn || !imgOut)
		return null
	
	const windowsIn = imgIn.halfDownsample(2).window(WINDOW_SIZE, WINDOW_SIZE, WINDOW_STRIDE, WINDOW_STRIDE)
	const windowsOut = imgOut.halfDownsample(2).window(WINDOW_SIZE, WINDOW_SIZE, WINDOW_STRIDE, WINDOW_STRIDE)
	
	let samples = []
	for (let i = 0; i < windowsIn.length; i++)
	{
		for (let r = 0; r < 4; r++)
		{
			samples.push({ input: windowsIn[i], output: windowsOut[i] })
			windowsIn[i] = windowsIn[i].rotate90Clockwise()
			windowsOut[i] = windowsIn[i].rotate90Clockwise()
		}
		
		windowsIn[i] = windowsIn[i].mirror()
		windowsOut[i] = windowsIn[i].mirror()
		
		for (let r = 0; r < 4; r++)
		{
			samples.push({ input: windowsIn[i], output: windowsOut[i] })
			windowsIn[i] = windowsIn[i].rotate90Clockwise()
			windowsOut[i] = windowsIn[i].rotate90Clockwise()
		}
	}
	
	return samples
}


async function run()
{
	const model = tf.sequential()
	model.add(tf.layers.conv2d({ inputShape: [WINDOW_SIZE, WINDOW_SIZE, 1], kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2dTranspose({ kernelSize:25, filters:1, stride:4, padding:"valid" }))
	model.compile({ optimizer: "adam", loss: "meanSquaredError", metrics: ["acc"] })
	model.summary()

	let samples = []
	let sampleIndex = 0
	while (true)
	{
		const newSamples = await loadSample("ml-samples/" + sampleIndex)
		if (!newSamples)
			break
		
		samples = [...samples, ...newSamples]
		sampleIndex++
	}
	
	console.log("num samples = " + samples.length)
	
	Utils.shuffleArray(samples)
	
	console.log("converting to tensors...")
	
	const xs = tf.tensor(samples.map(s => s.input .pixels)).reshape([-1, WINDOW_SIZE, WINDOW_SIZE, 1])
	const ys = tf.tensor(samples.map(s => s.output.pixels)).reshape([-1, WINDOW_SIZE, WINDOW_SIZE, 1])
	
	if (!fs.existsSync("ml-models"))
		fs.mkdirSync("ml-models")
	
	await model.fit(xs, ys, {
		epochs: 50,
		callbacks: { onBatchEnd: async () =>
		{ 
			try { await model.save("file://./ml-models/componentPlacement") }
			catch {}
		} }
	})
	
	await model.save("file://./ml-models/componentPlacement")
}


run()