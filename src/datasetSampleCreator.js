import { CanvasManager } from "./canvasManager.js"
import SingleChannelImage from "./singleChannelImage.js"
import * as ImageAnalysis from "./imageAnalysis.js"
import { debounce } from "./utils.js"


let gTable = null
let gIndex = 0

const IMAGE_WIDTH = 256
const IMAGE_HEIGHT = 256
const IMAGE_SCALE = 3

const canvasManagers = []
const textareaLabels = []


document.body.onload = function()
{
	gTable = document.createElement("table")
	document.body.appendChild(gTable)
	gTable.style.margin = "auto"
	
	let buttonSave = document.createElement("button")
	buttonSave.innerHTML = "Upload (Local Server Only)"
	buttonSave.style.width = "250px"
	buttonSave.style.height = "80px"
	buttonSave.onclick = () => { upload() }
	document.body.appendChild(buttonSave)
	
	let buttonLoad = document.createElement("button")
	buttonLoad.innerHTML = "Load from folder (Local Server Only)"
	buttonLoad.style.width = "250px"
	buttonLoad.style.height = "80px"
	buttonLoad.onclick = () => { load() }
	document.body.appendChild(buttonLoad)
	
	createRowSection(10)
}


async function load()
{
	async function loadImage(src)
	{
		return new Promise((resolve, reject) =>
		{
			let img = document.createElement("img")
			img.src = "/ml-samples/" + src
			img.onload = () =>
			{
				resolve(img)
			}
			
			img.onerror = () =>
			{
				resolve(null)
			}
		})
	}
	
	let i = 0
	while (true)
	{
		const imgIn = await loadImage(i + ".in.png")
		const imgOut = await loadImage(i + ".out.png")
		
		if (!imgIn || !imgOut)
			break
		
		if (i >= canvasManagers.length)
			createRowSection(10)
		
		canvasManagers[i].useCtx(0, ctx => ctx.drawImage(imgIn, 0, 0))
		canvasManagers[i].useCtx(1, ctx => ctx.drawImage(imgOut, 0, 0))
		canvasManagers[i].cleared = false
		canvasManagers[i].onDraw()
		
		i++
	}
}


async function upload()
{
	for (let c = 0; c < canvasManagers.length; c++)
	{
		const canvas = canvasManagers[c]
		const textarea = textareaLabels[c]
		
		if (canvas.cleared)
			continue
		
		let jsonData = { components: [] }
		const imageData = canvas.getImageData(1)
		const img = SingleChannelImage.fromImageData(imageData)
		const rects = ImageAnalysis.findRegions(img)
		const lines = textarea.value.split("\n")
		for (let r = 0; r < rects.length; r++)
		{
			jsonData.components.push({ rect: rects[r], kind: lines[r] })
		}
		
		const data = 
		{
			input: canvas.getData(0),
			output: canvas.getData(1),
			data: JSON.stringify(jsonData)
		}
		
		await fetch("/upload",
		{
			method: "post",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)			
		})
		
		//await new Promise((resolve, reject) => window.setTimeout(() => resolve(), 1000))
	}
}


function createRowSection(rowNum)
{
	for (let i = 0; i < rowNum; i++)
		createRow()
	
	let tr = document.createElement("tr")
	gTable.appendChild(tr)
	
	let td = document.createElement("td")
	tr.appendChild(td)
	
	let buttonMore = document.createElement("button")
	buttonMore.innerHTML = "Create More 10 Rows"
	td.appendChild(buttonMore)
	
	buttonMore.onclick = () =>
	{
		gTable.removeChild(tr)
		createRowSection(10)
	}
}


function createRow()
{
	let tr = document.createElement("tr")
	gTable.appendChild(tr)
	
	let td = []
	for (let i = 0; i < 4; i++)
	{
		td[i] = document.createElement("td")
		tr.appendChild(td[i])
	}
	
	let spanInfo = document.createElement("span")
	spanInfo.innerHTML = "Image #" + gIndex
	td[0].appendChild(spanInfo)
	
	let canvas = new CanvasManager(4, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_SCALE, ["0,0,0", "255,0,0", "0,255,0", "0,0,255"], [1,8,8])
	canvas.appendTo(td[1])
	canvasManagers.push(canvas)
	
	let textareaLabel = document.createElement("textarea")
	td[3].appendChild(textareaLabel)
	textareaLabel.style.width = "250px"
	textareaLabel.style.height = "120px"
	textareaLabel.placeholder = ""
	textareaLabels.push(textareaLabel)
	
	canvas.onDraw = debounce(() => updateRegions(canvas, textareaLabel))
	
	gIndex++
}


function updateRegions(canvas, textarea)
{
	const imageData = canvas.getImageData(1)
	const img = SingleChannelImage.fromImageData(imageData)
	const rects = ImageAnalysis.findRegions(img)
	
	canvas.useCtx(3, (ctx) =>
	{
		ctx.strokeStyle = "#00f"
		ctx.fillStyle = "#00f"
		ctx.font = "15px Verdana"
		
		ctx.clearRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
		
		for (let r = 0; r < rects.length; r++)
		{
			const rect = rects[r]
			ctx.strokeRect(rect.xMin, rect.yMin, rect.xMax - rect.xMin, rect.yMax - rect.yMin)
			ctx.fillText(r.toString(), rect.xMax + 5, (rect.yMin + rect.yMax) / 2)
		}
	})
}