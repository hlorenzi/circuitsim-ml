const tf = require('@tensorflow/tfjs')
require('@tensorflow/tfjs-node')

const fs = require("fs")
const { PNG } = require("pngjs")


function loadImage(filename)
{
	const data = fs.readFileSync(filename)
	const png = PNG.sync.read(data)
	
	let array = []
	for (let j = 0; j < png.height; j++)
	{
		array.push([])
		for (let i = 0; i < png.width; i++)
			array[j].push(png.data[(j * png.width + i) * 4 + 3] / 255)
	}
	
	return array
}


function halfDownsampleImage(array)
{
	const w = array[0].length
	const h = array.length
	
	let newImg = []
	
	for (let j = 0; j < h / 2; j++)
	{
		newImg.push([])
		for (let i = 0; i < w / 2; i++)
			newImg[j].push(0)
	}
			
	for (let j = 0; j < h; j++)
	for (let i = 0; i < w; i++)
		newImg[Math.floor(j / 2)][Math.floor(i / 2)] += array[j][i]
			
	for (let j = 0; j < h / 2; j++)
	for (let i = 0; i < w / 2; i++)
		newImg[j][i] = Math.min(1, newImg[j][i] / 2)
	
	return newImg
}


function windowImage(array, w, h, stride)
{
	const arrayW = array[0].length
	const arrayH = array.length
	
	let imgs = []
	
	for (let yMin = 0; yMin + h <= arrayH; yMin += stride)
	for (let xMin = 0; xMin + w <= arrayW; xMin += stride)
	{
		let img = []
		for (let j = 0; j < h; j++)
		{
			img.push([])
			for (let i = 0; i < w; i++)
				img[j].push(array[yMin + j][xMin + i])
		}
		
		imgs.push(img)
	}
	
	return imgs
}


function dewindowImage(windows, finalW, finalH, stride)
{
	const windowW = windows[0][0].length
	const windowH = windows[0].length
	
	let img = []
	let weights = []
	for (let j = 0; j < finalH; j++)
	{
		img.push([])
		weights.push([])
		for (let i = 0; i < finalW; i++)
		{
			img[j][i] = 0
			weights[j][i] = 0
		}
	}
	
	let yMin = 0
	let xMin = 0
	for (let wd = 0; wd < windows.length; wd++)
	{
		for (let j = 0; j < windowH; j++)
		{
			for (let i = 0; i < windowW; i++)
			{
				img[yMin + j][xMin + i] += windows[wd][j][i]
				weights[yMin + j][xMin + i] += 1
			}
		}
		
		xMin += stride
		if (xMin + windowH > finalW)
		{
			xMin = 0
			yMin += stride
		}
	}
	
	//for (let j = 0; j < finalH; j++)
	//for (let i = 0; i < finalW; i++)
	//	img[j][i] = img[j][i] / weights[j][i]
			
	return img
}


function saveImage(array, filename, color = [0,0,0])
{
	const w = array[0].length
	const h = array.length
	
	const png = new PNG({ colorType: 6, width: w, height: h })
	for (let j = 0; j < h; j++)
	for (let i = 0; i < w; i++)
	{
		const c = Math.max(0, Math.min(255, array[j][i] * 255))
		png.data[(j * w + i) * 4 + 0] = color[0]
		png.data[(j * w + i) * 4 + 1] = color[1]
		png.data[(j * w + i) * 4 + 2] = color[2]
		png.data[(j * w + i) * 4 + 3] = c
	}
	
	const options = { colorType: 6 }
	const buffer = PNG.sync.write(png, options)
	fs.writeFileSync(filename, buffer)
}


function loadSample(filenamePrefix)
{
	const imgIn = halfDownsampleImage(loadImage(filenamePrefix + ".in.png"))
	const imgOut = halfDownsampleImage(loadImage(filenamePrefix + ".out.png"))
	const windowsIn = windowImage(imgIn, 32, 32, 16)
	const windowsOut = windowImage(imgOut, 32, 32, 16)
	
	let samples = []
	for (let i = 0; i < windowsIn.length; i++)
		samples.push({ input: windowsIn[i], output: windowsOut[i] })
	
	return samples
}


async function run()
{
	let samples = []
	for (let i = 0; i <= 11; i++)
		samples = [...samples, ...loadSample("ml-data/" + i)]
	
	const model = tf.sequential()
	model.add(tf.layers.conv2d({ inputShape: [32,32,1], kernelSize:5, filters:32, stride:1, activation: "relu" }))
	model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2]}))
	model.add(tf.layers.conv2d({ kernelSize:5, filters:32, stride:1, activation: "relu" }))
	model.add(tf.layers.conv2dTranspose({ kernelSize:8, filters:32, stride:4, activation: "relu" }))
	model.add(tf.layers.conv2dTranspose({ kernelSize:16, filters:1, stride:4, activation: "relu" }))
	model.compile({optimizer: "adam", loss: "meanSquaredError", metrics: ["acc"] })
	model.summary()

	const xs = tf.tensor(samples.map(s => s.input)).reshape([-1,32,32,1])
	const ys = tf.tensor(samples.map(s => s.output)).reshape([-1,32,32,1])
	
	await model.fit(xs, ys, { epochs: 20 })
	
	const predictSamples = loadSample("ml-data/12")
	const xsP = tf.tensor(predictSamples.map(s => s.input)).reshape([-1,32,32,1])
	const result = await model.predict(xsP)
	
	const predictImg = dewindowImage(predictSamples.map(s => s.output), 128, 128, 16)
	const resultImg = dewindowImage(result.reshape([-1,32,32]).arraySync(), 128, 128, 16)
	
	if (!fs.existsSync("temp"))
		fs.mkdirSync("temp")
	
	saveImage(predictImg, "temp/prediction.in.png", [255,0,0])
	saveImage(resultImg, "temp/prediction.out.png", [255,0,0])
}


run()