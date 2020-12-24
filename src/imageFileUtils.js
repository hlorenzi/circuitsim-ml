import fs from "fs"
import PNG from "pngjs"
import SingleChannelImage from "./singleChannelImage.js"


export default class ImageFileUtils
{
	static async loadFromFile(filename)
	{
		try
		{
			const data = fs.readFileSync(filename)
			const png = PNG.PNG.sync.read(data)
			
			const img = new SingleChannelImage(png.width, png.height)
			
			for (let j = 0; j < png.height; j++)
			for (let i = 0; i < png.width; i++)
				img.setInPlace(i, j, png.data[(j * png.width + i) * 4 + 3] / 255)
			
			return img
		}
		catch (e)
		{
			if (e.code == "ENOENT")
				return null
			
			throw e
		}
	}


	static async saveToFile(img, filename, color = [0, 0, 0])
	{
		const png = new PNG.PNG({ colorType: 6, width: img.w, height: img.h })
		for (let j = 0; j < img.h; j++)
		for (let i = 0; i < img.w; i++)
		{
			const c = Math.max(0, Math.min(255, img.get(i, j) * 255))
			png.data[(j * img.w + i) * 4 + 0] = color[0]
			png.data[(j * img.w + i) * 4 + 1] = color[1]
			png.data[(j * img.w + i) * 4 + 2] = color[2]
			png.data[(j * img.w + i) * 4 + 3] = c
		}
		
		const options = { colorType: 6 }
		const buffer = PNG.PNG.sync.write(png, options)
		fs.writeFileSync(filename, buffer)
	}
}