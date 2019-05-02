const express = require("express")
const app = express()
const fs = require("fs")


app.use(express.json())
app.post("/upload", async (req, res) =>
{
	console.log("saving...")
	
	const pngIn = req.body.input.replace(/^data:image\/png;base64,/, "")
	const pngOut = req.body.output.replace(/^data:image\/png;base64,/, "")
	
	if (!fs.existsSync("ml-data"))
		fs.mkdirSync("ml-data")
	
	let index = 0
	while (fs.existsSync("ml-data/" + index + ".in.png"))
		index++
	
	fs.writeFileSync("ml-data/" + index + ".in.png", pngIn, "base64")
	fs.writeFileSync("ml-data/" + index + ".out.png", pngOut, "base64")
	
	console.log("saved ml-data/" + index)
})


app.use(express.static(__dirname + "/.webpack/"))
app.use(express.static(__dirname + "/public/"))


app.listen(80, () =>
{
	console.log("server started at port 80")
})