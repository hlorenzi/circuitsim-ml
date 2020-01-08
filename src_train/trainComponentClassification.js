import tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-node"

import fs from "fs"
import ImageFileUtils from "../src/imageFileUtils.js"
import * as Utils from "../src/utils.js"

const IMAGE_SIZE = 32

	
let debugSamplesIndex = 0


async function loadSample(sampleIndex)
{
	console.log("loading sample " + sampleIndex + "...")
	
	const imgIn = ImageFileUtils.loadFromFile("ml-samples/" + sampleIndex + ".in.png")
	
	if (!imgIn)
		return null
	
	const dataRaw = fs.readFileSync("ml-samples/" + sampleIndex + ".data.json", "utf-8")
	const data = JSON.parse(dataRaw)
			
	if (!fs.existsSync("temp"))
		fs.mkdirSync("temp")
	
	let samples = []
	for (let c = 0; c < data.components.length; c++)
	{
		const component = data.components[c]
		
		for (let margin = 10; margin <= 10; margin += 1)
		{
			const imgComponent = imgIn
				.crop(component.rect.xMin - margin, component.rect.yMin - margin, component.rect.xMax + margin, component.rect.yMax + margin)
				.halfDownsample(2)
				.stretch(IMAGE_SIZE, IMAGE_SIZE)
				
			//samples.push({ input: imgComponent, output: component.kind })
			
			let imgRotated = imgComponent
			let imgMirroredRotated = imgComponent.mirror()
			let kindRotated = component.kind
			let kindMirroredRotated = mirrorKind(component.kind)
			for (let r = 0; r < 4; r++)
			{
				samples.push({ input: imgRotated, output: kindRotated })
				samples.push({ input: imgMirroredRotated, output: kindMirroredRotated })
			
				/*if (margin == 10)
				{
					ImageFileUtils.saveToFile(imgRotated, "temp/sample_" + sampleIndex + "_c" + c + "_m0_r" + r + "_" + kindRotated + ".png")
					debugSamplesIndex++
					ImageFileUtils.saveToFile(imgMirroredRotated, "temp/sample_" + sampleIndex + "_c" + c + "_m1_r" + r + "_" + kindMirroredRotated + ".png")
					debugSamplesIndex++
				}*/
				
				imgRotated = imgRotated.rotate90Clockwise()
				imgMirroredRotated = imgMirroredRotated.rotate90Clockwise()
				kindRotated = rotate90ClockwiseKind(kindRotated)
				kindMirroredRotated = rotate90ClockwiseKind(kindMirroredRotated)
			}
		}
	}
	
	return samples
}


function mirrorKind(kind)
{
	if (kind.endsWith(".r"))
		return kind.substr(0, kind.length - 2) + ".l"
	
	if (kind.endsWith(".l"))
		return kind.substr(0, kind.length - 2) + ".r"
	
	return kind
}


function rotate90ClockwiseKind(kind)
{
	if (kind.endsWith(".h"))
		return kind.substr(0, kind.length - 2) + ".v"
	
	if (kind.endsWith(".v"))
		return kind.substr(0, kind.length - 2) + ".h"
	
	if (kind.endsWith(".r"))
		return kind.substr(0, kind.length - 2) + ".d"
	
	if (kind.endsWith(".d"))
		return kind.substr(0, kind.length - 2) + ".l"
	
	if (kind.endsWith(".l"))
		return kind.substr(0, kind.length - 2) + ".u"
	
	if (kind.endsWith(".u"))
		return kind.substr(0, kind.length - 2) + ".r"
	
	return kind
}


function buildCategories(samples)
{
	const set = new Set()
	samples.forEach(s => set.add(s.output))
	return [...set]
}


async function run()
{
	let samples = []
	let sampleIndex = 0
	while (true)
	{
		const newSamples = await loadSample(sampleIndex)
		if (!newSamples)
			break
		
		samples = [...samples, ...newSamples]
		sampleIndex++
	}
	
	const categories = buildCategories(samples)
	
	console.log("num samples = " + samples.length)
	console.log("num categories = " + categories.length)
	console.log(categories)
	
	const model = tf.sequential()
	model.add(tf.layers.conv2d({ inputShape: [IMAGE_SIZE, IMAGE_SIZE, 1], kernelSize:5, filters:16, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.dropout({ rate: 0.5 }))
	model.add(tf.layers.maxPooling2d({ poolSize: [4, 4], strides: [4, 4]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:16, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.dropout({ rate: 0.5 }))
	model.add(tf.layers.maxPooling2d({ poolSize: [4, 4], strides: [4, 4]}))
	//model.add(tf.layers.dropout({ rate: 0.5 }))
	//model.add(tf.layers.conv2d({ kernelSize:5, filters:16, stride:1, padding:"same", activation: "relu" }))
	//model.add(tf.layers.dropout({ rate: 0.5 }))
	//model.add(tf.layers.conv2d({ kernelSize:5, filters:16, stride:1, padding:"same", activation: "relu" }))
	//model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	//model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	//model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.flatten())
	model.add(tf.layers.dense({ units: categories.length, useBias: true, activation: "softmax" }))
	model.compile({ optimizer: "adam", loss: "categoricalCrossentropy", metrics: ["acc"] })
	model.summary()

	Utils.shuffleArray(samples)
	
	console.log("converting to tensors...")
	
	const xs = tf.tensor(samples.map(s => s.input.pixels)).reshape([-1, IMAGE_SIZE, IMAGE_SIZE, 1])
	const ys = tf.tensor(samples.map(s => Utils.encodeOneHot(categories.findIndex(c => c == s.output), categories.length))).reshape([-1, categories.length])
	
	if (!fs.existsSync("ml-models"))
		fs.mkdirSync("ml-models")
	
	fs.writeFileSync("ml-models/componentClassificationCategories.json", JSON.stringify(categories, null, 2))
	
	await model.fit(xs, ys, {
		epochs: 500,
		callbacks: { onBatchEnd: async () => await model.save("file://./ml-models/componentClassification") }
	})
	
	await model.save("file://./ml-models/componentClassification")
}


run()