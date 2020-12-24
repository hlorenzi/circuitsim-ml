const express = require("express")
const app = express()
const fs = require("fs")


app.use(express.json())
app.post("/upload", async (req, res) =>
{
	console.log("saving...")
	
	const pngIn = req.body.input.replace(/^data:image\/png;base64,/, "")
	const pngOut = req.body.output.replace(/^data:image\/png;base64,/, "")
	const dataOut = JSON.stringify(JSON.parse(req.body.data), null, 4)
	
	if (!fs.existsSync("ml-samples"))
		fs.mkdirSync("ml-samples")
	
	let index = 0
	while (fs.existsSync("ml-samples/" + index + ".in.png"))
		index++
	
	fs.writeFileSync("ml-samples/" + index + ".in.png", pngIn, "base64")
	fs.writeFileSync("ml-samples/" + index + ".out.png", pngOut, "base64")
	fs.writeFileSync("ml-samples/" + index + ".data.json", dataOut, "utf-8")
	
	console.log("saved ml-samples/" + index)
	
	res.sendStatus(200)
})


app.use("/ml-samples", express.static(__dirname + "/ml-samples/"))
app.use("/ml-models", express.static(__dirname + "/ml-models/"))
app.use(express.static(__dirname + "/.webpack/"))
app.use(express.static(__dirname + "/public/"))


app.listen(80, () =>
{
	console.log("server started at port 80")
})