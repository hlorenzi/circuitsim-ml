let gTable = null
let gIndex = 0

const IMAGE_WIDTH = 256
const IMAGE_HEIGHT = 256
const IMAGE_SCALE = 3

const canvasManagers = []


document.body.onload = function()
{
	gTable = document.createElement("table")
	document.body.appendChild(gTable)
	gTable.style.margin = "auto"
	
	let buttonSave = document.createElement("button")
	buttonSave.innerHTML = "Upload"
	buttonSave.style.width = "150px"
	buttonSave.style.height = "80px"
	buttonSave.onclick = () => { upload() }
	document.body.appendChild(buttonSave)
	
	createRowSection(10)
}


function upload()
{
	for (const canvas of canvasManagers)
	{
		if (canvas.cleared)
			continue
		
		const data = 
		{
			input: canvas.getData(0),
			output: canvas.getData(1),
		}
		
		fetch("/upload",
		{
			method: "post",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)			
		})
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
	
	let canvas = new CanvasManager(3, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_SCALE, ["0,0,0", "255,0,0", "0,255,0"], [1,5,5])
	canvas.appendTo(td[1])
	canvasManagers.push(canvas)
	
	let textareaLabels = document.createElement("textarea")
	td[3].appendChild(textareaLabels)
	textareaLabels.style.width = "250px"
	textareaLabels.style.height = "120px"
	textareaLabels.placeholder = "<same as above>"
	
	gIndex++
}


class CanvasManager
{
	constructor(layers, width, height, scale, colors, drawWidths)
	{
		this.width = width
		this.height = height
		this.scale = scale
		this.colors = colors
		this.drawWidths = drawWidths
		
		this.cleared = true
		
		this.div = document.createElement("div")
		this.div.style.position = "relative"
		this.div.style.width = (width * scale) + "px"
		this.div.style.height = (height * scale) + "px"
		this.div.style.backgroundColor = "#ccc"
		
		this.divButtons = document.createElement("div")
		this.divClearButtons = document.createElement("div")
		this.divClearButtons.style.marginTop = "10px"
		
		const buttonClearAll = document.createElement("button")
		buttonClearAll.innerHTML = "Clear All"
		buttonClearAll.onclick = () => { this.clearAll() }
		buttonClearAll.style.marginRight = "5px"
		this.divClearButtons.appendChild(buttonClearAll)
		
		const buttonClearCurrent = document.createElement("button")
		buttonClearCurrent.innerHTML = "Clear Current"
		buttonClearCurrent.onclick = () => { this.clear(this.drawLayer) }
		buttonClearCurrent.style.marginRight = "5px"
		this.divClearButtons.appendChild(buttonClearCurrent)
		
		this.canvases = []
		this.ctxs = []
		for (let i = 0; i < layers; i++)
		{
			this.canvases[i] = document.createElement("canvas")
			this.canvases[i].width = width
			this.canvases[i].height = height
			this.canvases[i].style.width = (width * scale) + "px"
			this.canvases[i].style.height = (height * scale) + "px"
			this.canvases[i].style.display = "block"
			this.canvases[i].style.position = "absolute"
			this.canvases[i].style.left = "0px"
			this.canvases[i].style.top = "0px"
			this.canvases[i].style.opacity = (i == 0 ? "1" : "0.5")
			this.ctxs[i] = this.canvases[i].getContext("2d")
			this.ctxs[i].fillStyle = "rgba(" + colors[i] + ",0)"
			this.ctxs[i].fillRect(0, 0, this.width, this.height)
			
			this.div.appendChild(this.canvases[i])
			
			const buttonSwitch = document.createElement("button")
			buttonSwitch.innerHTML = "Layer " + (i + 1).toString()
			buttonSwitch.onclick = () => { this.drawLayer = i }
			buttonSwitch.style.marginRight = "5px"
			this.divButtons.appendChild(buttonSwitch)
			
			/*const buttonClear = document.createElement("button")
			buttonClear.innerHTML = "Clear " + (i + 1).toString()
			buttonClear.onclick = () => { this.clear(i) }
			buttonClear.style.marginRight = "5px"
			this.divClearButtons.appendChild(buttonClear)*/
		}
		
		this.mouseDown = false
		this.mousePos = null
		
		this.touchDown = null
		
		this.topCanvas = this.canvases[this.canvases.length - 1]
		this.topCanvas.onmousedown  = (ev) => this.onMouseDown(ev)
		window.addEventListener("mousemove", (ev) => this.onMouseMove(ev))
		window.addEventListener("mouseup",   (ev) => this.onMouseUp(ev))
		
		this.topCanvas.addEventListener("touchstart",  (ev) => this.onTouchStart(ev))
		this.topCanvas.addEventListener("touchmove",   (ev) => this.onTouchMove (ev))
		this.topCanvas.addEventListener("touchend",    (ev) => this.onTouchEnd  (ev))
		this.topCanvas.addEventListener("touchcancel", (ev) => this.onTouchEnd  (ev))
		
		this.onDraw = () => { }
		this.drawLayer = 0
	}
	
	
	appendTo(parent)
	{
		parent.appendChild(this.div)
		parent.appendChild(this.divButtons)
		parent.appendChild(this.divClearButtons)
	}
	
	
	clearAll()
	{
		this.cleared = true
		for (let i = 0; i < this.canvases.length; i++)
			this.clear(i)
	}
	
	
	clear(layer)
	{
		const ctx = this.ctxs[layer]
		ctx.fillStyle = "rgba(" + this.colors[layer] + ",0)"
		ctx.clearRect(0, 0, this.width, this.height)
		ctx.fillRect(0, 0, this.width, this.height)
		this.onDraw()
	}
	
	
	copyTo(manager, layer)
	{
		manager.ctxs[layer].drawImage(this.canvases[this.drawLayer], 0, 0)
	}
	
	
	getData(layer)
	{
		let data = { width: this.width, height: this.height, data: [] }
		
		return this.canvases[layer].toDataURL("image/png")//.getImageData(0, 0, this.width, this.height)
	}
	
	
	getMousePos(ev)
	{
		const rect = this.topCanvas.getBoundingClientRect()
		return {
			x: (ev.clientX - rect.left) / this.scale,
			y: (ev.clientY - rect.top ) / this.scale
		}
	}
	
	
	onMouseDown(ev)
	{
		ev.preventDefault()
		
		if (!this.mouseDown)
		{
			this.mouseDown = true
			this.mousePos = this.getMousePos(ev)
			
			this.drawStroke(this.mousePos, { x: this.mousePos.x + 0.1, y: this.mousePos.y })
		}
	}
	
	
	onMouseMove(ev)
	{
		ev.preventDefault()
		
		if (this.mouseDown)
		{
			const mousePosPrev = this.mousePos
			this.mousePos = this.getMousePos(ev)
			
			this.drawStroke(mousePosPrev, this.mousePos)
		}
	}
	
	
	onMouseUp(ev)
	{
		ev.preventDefault()
		
		if (this.mouseDown)
		{
			this.mouseDown = false
			
			const mousePosPrev = this.mousePos
			this.mousePos = this.getMousePos(ev)
			
			this.drawStroke(mousePosPrev, this.mousePos)
			this.onDraw()
		}
	}
	
	
	onTouchStart(ev)
	{
		ev.preventDefault()
		
		if (this.touchDown == null)
		{
			this.touchDown = ev.touches[0].identifier
			this.touchPos = this.getMousePos(ev.touches[0])
		}
	}
	
	
	onTouchMove(ev)
	{
		ev.preventDefault()
		
		let touch = null
		for (const t of ev.touches)
		{
			if (t.identifier == this.touchDown)
				touch = t
		}
		
		if (touch != null)
		{
			const touchPosPrev = this.touchPos
			this.touchPos = this.getMousePos(touch)
			
			this.drawStroke(touchPosPrev, this.touchPos)
		}
	}
	
	
	onTouchEnd(ev)
	{
		ev.preventDefault()
		
		let touch = null
		for (const t of ev.touches)
		{
			if (t.identifier == this.touchDown)
				touch = t
		}
		
		if (touch == null)
		{
			this.touchDown = null
			this.onDraw()
		}
	}
	
	
	drawStroke(p1, p2)
	{
		this.cleared = false
		
		const ctx = this.ctxs[this.drawLayer]
		ctx.strokeStyle = "rgba(" + this.colors[this.drawLayer] + ",1)"
		ctx.lineWidth = this.drawWidths[this.drawLayer]
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(p1.x, p1.y)
		ctx.lineTo(p2.x, p2.y)
		ctx.stroke()
	}
}