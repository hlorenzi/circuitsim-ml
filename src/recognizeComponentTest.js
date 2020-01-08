import * as tf from "@tensorflow/tfjs"
import { CanvasManager } from "./canvasManager.js"
import SingleChannelImage from "./singleChannelImage.js"
import * as ImageAnalysis from "./imageAnalysis.js"
import * as Utils from "./utils.js"


const IMAGE_WIDTH = 256
const IMAGE_HEIGHT = 256
const IMAGE_SCALE = 3

let canvas = null
let modelPlacement = null
let modelClassification = null
let modelClassificationCategories = null
let runningModel = false
let spanAnalyzing = null


document.body.onload = async function()
{
	let table = document.createElement("table")
	document.body.appendChild(table)
	table.style.margin = "auto"
	
	let tr = document.createElement("tr")
	table.appendChild(tr)
	
	let td = document.createElement("td")
	tr.appendChild(td)
	
	let spanLoading = document.createElement("span")
	spanLoading.innerHTML = "Loading models..."
	td.appendChild(spanLoading)
	
	modelPlacement = await tf.loadLayersModel("/ml-models/componentPlacement/model.json")
	modelPlacement.summary()
	
	modelClassification = await tf.loadLayersModel("/ml-models/componentClassification/model.json")
	modelClassification.summary()
	
	modelClassificationCategories = await (await fetch("/ml-models/componentClassificationCategories.json")).json()
	console.log(modelClassificationCategories)
	
	td.removeChild(spanLoading)
	
	canvas = new CanvasManager(2, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_SCALE, ["0,0,0", "255,0,0"], [1,8])
	canvas.appendTo(td)
	canvas.onDrawFrequent = Utils.debounce(() => { runModel() }, 1500)
	
	spanAnalyzing = document.createElement("span")
	spanAnalyzing.innerHTML = "Analyzing..."
	spanAnalyzing.style.color = "red"
	spanAnalyzing.style.fontSize = "150%"
	spanAnalyzing.style.fontWeight = "bold"
	spanAnalyzing.style.visibility = "hidden"
	td.appendChild(spanAnalyzing)
}


async function runModel()
{
	if (runningModel)
		return
	
	runningModel = true
	spanAnalyzing.style.visibility = "visible"
	canvas.setOpacity(0.6)
	
	await new Promise((resolve, reject) => window.setTimeout(() => resolve(), 1))
	
	const imageData = canvas.getImageData(0)
	const img = SingleChannelImage.fromImageData(imageData)
	
	const imgDownsampled = img.halfDownsample(2)
	const imgWindows = imgDownsampled.window(32, 32, 8, 8)
	const imgBuffers = imgWindows.map(w => w.pixels)
	const prediction = await modelPlacement.predict(tf.tensor(imgBuffers).reshape([-1, 32, 32, 1]))
	const predictionBuffers = await prediction.reshape([-1, 32 * 32]).array()
	const predictionWindows = predictionBuffers.map(w => SingleChannelImage.fromArray(w, 32, 32))
	const predictionImg = SingleChannelImage.dewindow(predictionWindows, imgDownsampled.w, imgDownsampled.h, 8, 8)
	const predictionImgUpsampled = predictionImg.doubleUpsample()
	
	const predictionImageData = predictionImgUpsampled.toImageDataBuffer([255, 0, 0])
	canvas.putImageDataBuffer(1, img.w, img.h, predictionImageData)
	
	await new Promise((resolve, reject) => window.setTimeout(() => resolve(), 1))
	
	const rects = ImageAnalysis.findRegions(predictionImgUpsampled)
	console.log(rects)
	for (const rect of rects)
	{
		canvas.useCtx(1, (ctx) =>
		{
			ctx.strokeStyle = "#080"
			ctx.lineWidth = 1
			ctx.translate(0.5, 0.5)
			ctx.strokeRect(rect.xMin, rect.yMin, rect.xMax - rect.xMin, rect.yMax - rect.yMin)
		})
	}
	
	await new Promise((resolve, reject) => window.setTimeout(() => resolve(), 1))
	
	for (const rect of rects)
	{
		const margin = 10
		const imgRect = img.crop(rect.xMin - margin, rect.yMin - margin, rect.xMax + margin, rect.yMax + margin).halfDownsample(2).stretch(32, 32)
		const classPrediction = await modelClassification.predict(tf.tensor(imgRect.pixels).reshape([1, 32, 32, 1]))
		const classIndex = await classPrediction.reshape([modelClassificationCategories.length]).argMax().array()
		rect.kind = modelClassificationCategories[classIndex]
		console.log(rect.kind)
	}
	
	await new Promise((resolve, reject) => window.setTimeout(() => resolve(), 1))
	
	const trails = ImageAnalysis.findTrails(img, rects)
	console.log(trails)
	for (const trail of trails)
	{
		canvas.useCtx(1, (ctx) =>
		{
			ctx.strokeStyle = "#00f"
			ctx.fillStyle = "#00f"
			ctx.lineWidth = 2
			ctx.translate(0.5, 0.5)
			ctx.beginPath()
			ctx.arc(trail.x, trail.y, 3, 0, Math.PI * 2)
			ctx.stroke()
			
			ctx.font = "Verdana 6px"
			ctx.textBaseline = "middle"
			ctx.fillText(trail.id.toString(), trail.x + 6, trail.y + 6)
			
			for (const link of trail.links)
			{
				ctx.beginPath()
				ctx.moveTo(trail.x, trail.y)
				ctx.lineTo(link.x, link.y)
				ctx.stroke()
			}
			
			ctx.strokeStyle = "#f00"
			for (const link of trail.worseLinks)
			{
				ctx.beginPath()
				ctx.moveTo(trail.x, trail.y)
				ctx.lineTo(link.x, link.y)
				ctx.stroke()
			}
		})
	}
	
	const segments = ImageAnalysis.segmentTrails(trails)
	for (const segment of segments)
	{
		canvas.useCtx(1, (ctx) =>
		{
			const r = Math.floor(Math.random() * 255).toString(16).padStart(2, "0")
			const g = Math.floor(Math.random() * 255).toString(16).padStart(2, "0")
			const b = Math.floor(Math.random() * 255).toString(16).padStart(2, "0")
			const c = "#" + r + g + b
			
			ctx.strokeStyle = c
			ctx.lineWidth = 4
			ctx.translate(0.5, 0.5)
			
			for (const trail of segment.trails)
			{
				ctx.beginPath()
				ctx.arc(trail.x, trail.y, 3, 0, Math.PI * 2)
				ctx.stroke()
					
				for (const link of trail.links)
				{
					ctx.beginPath()
					ctx.moveTo(trail.x, trail.y)
					ctx.lineTo(link.x, link.y)
					ctx.stroke()
				}
			}
		})
	}
	
	for (const rect of rects)
	{
		canvas.useCtx(1, (ctx) =>
		{
			ctx.fillStyle = "#fff"
			ctx.font = "Verdana 6px"
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.fillText(rect.kind, (rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2)
		})
	}
	
	runningModel = false
	spanAnalyzing.style.visibility = "hidden"
	canvas.setOpacity(1)
}