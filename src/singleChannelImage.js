function lerp(a, b, t)
{
	return a + (b - a) * t
}


export default class SingleChannelImage
{
	constructor(w, h, fillValue = 0)
	{
		this.pixels = new Float32Array(w * h)
		this.w = w
		this.h = h
	}
	
	
	clone()
	{
		const cloned = new SingleChannelImage(this.w, this.h)
		for (let i = 0; i < this.w * this.h; i++)
			cloned.pixels[i] = this.pixels[i]
		
		return cloned
	}
	
	
	get(x, y, def = 0)
	{
		if (x < 0 || x >= this.w || y < 0 || y >= this.h)
			return def
		
		return this.pixels[y * this.w + x]
	}
	
	
	getBilinear(x, y, def = 0)
	{
		if (x < 0 || x >= this.w || y < 0 || y >= this.h)
			return def
		
		const x1 = Math.floor(x)
		const x2 = Math.ceil(x)
		const y1 = Math.floor(y)
		const y2 = Math.ceil(y)
		const xT = x - Math.floor(x)
		const yT = y - Math.floor(y)
		
		const cY1 = lerp(this.get(x1, y1), this.get(x2, y1), xT)
		const cY2 = lerp(this.get(x1, y2), this.get(x2, y2), xT)
		
		return lerp(cY1, cY2, yT)
	}
	
	
	set(x, y, value)
	{
		if (x < 0 || x >= this.w || y < 0 || y >= this.h)
			return this
		
		const cloned = this.clone()
		cloned.setInPlace(x, y, value)
		return cloned
	}
	
	
	setInPlace(x, y, value)
	{
		if (x < 0 || x >= this.w || y < 0 || y >= this.h)
			return
		
		this.pixels[y * this.w + x] = value
	}
	
	
	addInPlace(x, y, value)
	{
		if (x < 0 || x >= this.w || y < 0 || y >= this.h)
			return
		
		this.pixels[y * this.w + x] += value
	}
	
	
	some(fn)
	{
		return this.pixels.some(fn)
	}
	
	
	every(fn)
	{
		return this.pixels.every(fn)
	}
	
	
	forEach(fn)
	{
		this.pixels.forEach(fn)
	}
	
	
	mapInPlace(fn)
	{
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
			this.setInPlace(i, j, fn(this.get(i, j), i, j))
	}
	
	
	static fromArray(array, w, h)
	{
		const img = new SingleChannelImage(w, h)
		
		for (let j = 0; j < h; j++)
		for (let i = 0; i < w; i++)
			img.setInPlace(i, j, array[j * w + i])
		
		return img
	}


	toArray()
	{
		let array = new Array(this.w * this.h)
		
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
			array[j * this.w + i] = this.get(i, j)
		
		return array
	}
	
	
	static fromImageData(imageData, channel = 3)
	{
		const img = new SingleChannelImage(imageData.width, imageData.height)
		
		for (let j = 0; j < imageData.height; j++)
		for (let i = 0; i < imageData.width; i++)
			img.setInPlace(i, j, imageData.data[(j * imageData.width + i) * 4 + channel] / 255)
		
		return img
	}


	toImageDataBuffer(color = [0, 0, 0])
	{
		let buffer = new Array(this.w * this.h * 4)
		
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
		{
			buffer[(j * this.w + i) * 4 + 0] = color[0]
			buffer[(j * this.w + i) * 4 + 1] = color[1]
			buffer[(j * this.w + i) * 4 + 2] = color[2]
			buffer[(j * this.w + i) * 4 + 3] = Math.max(0, Math.min(255, this.get(i, j) * 255))
		}
		
		return buffer
	}
	
	
	halfDownsample(colorGainFactor = 1)
	{
		const img = new SingleChannelImage(this.w / 2, this.h / 2)
		
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
			img.addInPlace(Math.floor(i / 2), Math.floor(j / 2), this.get(i, j))
				
		img.mapInPlace(c => Math.min(1, c * colorGainFactor / 4))
		return img
	}
	
	
	doubleUpsample()
	{
		const img = new SingleChannelImage(this.w * 2, this.h * 2)
				
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
		{
			img.setInPlace(i * 2 + 0, j * 2 + 0, this.get(i, j))
			img.setInPlace(i * 2 + 1, j * 2 + 0, this.get(i, j))
			img.setInPlace(i * 2 + 0, j * 2 + 1, this.get(i, j))
			img.setInPlace(i * 2 + 1, j * 2 + 1, this.get(i, j))
		}
		
		return img
	}
	
	
	mirror()
	{
		const img = new SingleChannelImage(this.w, this.h)
		
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
			img.setInPlace(i, j, this.get(this.w - i - 1, j))
		
		return img
	}
	
	
	rotate90Clockwise()
	{
		const img = new SingleChannelImage(this.w, this.h)
		
		for (let j = 0; j < this.h; j++)
		for (let i = 0; i < this.w; i++)
			img.setInPlace(i, j, this.get(this.h - j - 1, i))
		
		return img
	}
	
	
	window(windowW, windowH, windowStrideX, windowStrideY)
	{
		let imgs = []
		
		for (let yMin = 0; yMin < this.h; yMin += windowStrideY)
		for (let xMin = 0; xMin < this.w; xMin += windowStrideX)
		{
			let img = new SingleChannelImage(windowW, windowH)
			for (let j = 0; j < this.h; j++)
			for (let i = 0; i < this.w; i++)
				img.setInPlace(i, j, this.get(xMin + i, yMin + j))
			
			imgs.push(img)
		}
		
		return imgs
	}
	
	
	static dewindow(windows, originalW, originalH, windowStrideX, windowStrideY)
	{
		const img = new SingleChannelImage(originalW, originalH)
		const weights = new SingleChannelImage(originalW, originalH)
		
		const windowW = windows[0].w
		const windowH = windows[0].h
		
		let yMin = 0
		let xMin = 0
		for (let wd = 0; wd < windows.length; wd++)
		{
			for (let j = 0; j < windowH; j++)
			for (let i = 0; i < windowW; i++)
			{
				img.addInPlace(xMin + i, yMin + j, windows[wd].get(i, j))
				weights.addInPlace(xMin + i, yMin + j, 1)
			}
			
			xMin += windowStrideX
			if (xMin >= originalW)
			{
				xMin = 0
				yMin += windowStrideY
			}
		}
		
		img.mapInPlace((c, i, j) => c / weights.get(i, j))
		return img
	}
	
	
	crop(x1, y1, x2, y2)
	{
		const newW = x2 - x1
		const newH = y2 - y1
		
		const img = new SingleChannelImage(newW, newH)
		
		for (let j = 0; j < newH; j++)
		for (let i = 0; i < newW; i++)
			img.setInPlace(i, j, this.get(x1 + i, y1 + j))
		
		return img
	}
	
	
	stretch(newW, newH)
	{
		const img = new SingleChannelImage(newW, newH)
		
		for (let j = 0; j < newH; j++)
		for (let i = 0; i < newW; i++)
			img.setInPlace(i, j, this.getBilinear(i / newW * this.w, j / newH * this.h))
		
		return img
	}
}