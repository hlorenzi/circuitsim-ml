import tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-node"

import fs from "fs"
import ImageFileUtils from "../src/imageFileUtils.js"
import * as Utils from "../src/utils.js"

const IMAGE_SIZE = 32


async function loadSample(filenamePrefix)
{
	console.log("loading sample " + filenamePrefix + "...")
	
	const imgIn = await ImageFileUtils.loadFromFile(filenamePrefix + ".in.png")
	
	if (!imgIn)
		return null
	
	const dataRaw = fs.readFileSync(filenamePrefix + ".data.json", "utf-8")
	const data = JSON.parse(dataRaw)
	
	let samples = []
	for (const component of data.components)
	{
		for (let margin = 5; margin <= 10; margin += 1)
		{
			const imgComponent = imgIn
				.crop(component.rect.xMin - margin, component.rect.yMin - margin, component.rect.xMax + margin, component.rect.yMax + margin)
				.stretch(IMAGE_SIZE, IMAGE_SIZE)
				
			//samples.push({ input: imgComponent, output: component.kind })
			
			let imgRotated = imgComponent
			let kindRotated = component.kind
			let imgMirroredRotated = imgComponent.mirror()
			let kindMirroredRotated = mirrorKind(component.kind)
			for (let r = 0; r < 4; r++)
			{
				samples.push({ input: imgRotated, output: kindRotated })
				samples.push({ input: imgMirroredRotated, output: kindMirroredRotated })
				
				imgRotated = imgRotated.rotate90Clockwise()
				kindMirroredRotated = rotate90ClockwiseKind(kindMirroredRotated)
			}
			
			//await ImageFileUtils.saveToFile(imgComponent, "test.png")
			//await new Promise((resolve, _) => setTimeout(() => resolve(), 1000))
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
		const newSamples = await loadSample("ml-samples/" + sampleIndex)
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
	model.add(tf.layers.conv2d({ inputShape: [IMAGE_SIZE, IMAGE_SIZE, 1], kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, padding:"same", activation: "relu" }))
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