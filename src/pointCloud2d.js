import Rect from "./rect.js"


export default class PointCloud2D
{
	constructor()
	{
		this.points = []
		this.table = null
		this.cellNum = 20
	}
	
	
	addPoint(p)
	{
		this.points.push(p)
		this.table = null
	}
	
	
	getTableCellFor(x, y)
	{
		if (!this.table)
			throw "not built"
		
		const xCell = Math.floor((x - this.table.xMin) / (this.table.xMax + 1 - this.table.xMin))
		const yCell = Math.floor((y - this.table.yMin) / (this.table.yMax + 1 - this.table.yMin))
		return { x: xCell, y: yCell, i: yCell * this.cellNum + xCell }
	}
	
	
	getTableCellRect(xCell, yCell)
	{
		return new Rect(
			this.table.xMin + xCell * (this.table.xMax - this.table.xMin) / this.cellNum,
			this.table.yMin + yCell * (this.table.yMax - this.table.yMin) / this.cellNum,
			(this.table.xMax - this.table.xMin) / this.cellNum,
			(this.table.yMax - this.table.yMin) / this.cellNum)
	}
	
	
	ensureBuilt()
	{
		if (this.table)
			return
		
		let bbox =
		{
			xMin: null,
			yMin: null,
			xMax: null,
			yMax: null
		}
		
		for (const p of this.points)
		{
			bbox.xMin = (bbox.xMin === null ? p.x : Math.min(bbox.xMin, p.x))
			bbox.yMin = (bbox.yMin === null ? p.y : Math.min(bbox.yMin, p.y))
			bbox.xMax = (bbox.xMax === null ? p.x : Math.max(bbox.xMax, p.x))
			bbox.yMax = (bbox.yMax === null ? p.y : Math.max(bbox.yMax, p.y))
		}
		
		this.table =
		{
			...bbox,
			cells: new Array(this.cellNum * this.cellNum)
		}
			
		for (let i = 0; i < this.cellNum * this.cellNum; i++)
			this.table.cells[i] = []
		
		for (const p of this.points)
		{
			const cell = this.getTableCellFor(p.x, p.y)
			this.table.cells[cell.i].push(p)
		}
	}
	
	
	*enumerateNearSlow(x, y, maxDistance)
	{
		for (const p of this.points)
		{
			const xDist = p.x - x
			const yDist = p.y - y
			if (xDist * xDist + yDist * yDist > maxDistance * maxDistance)
				continue
			
			yield p
		}
	}
	
	
	findNearest(x, y, maxDistance = Infinity)
	{
		this.ensureBuilt()
		
		if (!isFinite(maxDistance))
			maxDistance = Math.max(this.table.xMax - this.table.xMin, this.table.yMax - this.table.yMin)
		
		let near = []
		for (const point of this.enumerateNear(x, y, maxDistance))
			near.push(point)
		
		const distSqr = (x1, y1, x2, y2) =>
		{
			const xx = x2 - x1
			const yy = y2 - y1
			return (xx * xx + yy * yy)
		}
		
		near.sort((a, b) => distSqr(a.x, a.y, x, y) - distSqr(b.x, b.y, x, y))
		return near.length > 0 ? near[0] : null
	}
	
	
	*enumerateNear(x, y, maxDistance)
	{
		this.ensureBuilt()
		
		const nearRect = new Rect(x - maxDistance, y - maxDistance, maxDistance * 2, maxDistance * 2)
		
		const centerCell = this.getTableCellFor(x, y)
			
		if (centerCell.i >= 0 && centerCell.i < this.cellNum * this.cellNum)
		{
			for (const p of this.table.cells[centerCell.i])
			{
				const xDist = p.x - x
				const yDist = p.y - y
				if (xDist * xDist + yDist * yDist > maxDistance * maxDistance)
					continue
				
				yield p
			}
		}
		
		for (let step = 1; step < this.cellNum; step++)
		{
			let mustExpand = false
			for (let xCell = -step; xCell <= step; xCell++)
			for (let yCell = -step; yCell <= step; yCell += step * 2)
			{
				const iCell = yCell * this.cellNum + xCell
				if (iCell < 0 || iCell >= this.cellNum * this.cellNum)
					continue
				
				if (!this.getTableCellRect(xCell, yCell).overlaps(nearRect))
					continue
				
				mustExpand = true
				for (const p of this.table.cells[iCell])
				{
					const xDist = p.x - x
					const yDist = p.y - y
					if (xDist * xDist + yDist * yDist > maxDistance * maxDistance)
						continue
					
					yield p
				}
			}
			
			for (let yCell = -step + 1; yCell <= step - 1; yCell++)
			for (let xCell = -step; xCell <= step; xCell += step * 2)
			{
				const iCell = yCell * this.cellNum + xCell
				if (iCell < 0 || iCell >= this.cellNum * this.cellNum)
					continue
				
				if (!this.getTableCellRect(xCell, yCell).overlaps(nearRect))
					continue
				
				mustExpand = true
				for (const p of this.table.cells[iCell])
				{
					const xDist = p.x - x
					const yDist = p.y - y
					if (xDist * xDist + yDist * yDist > maxDistance * maxDistance)
						continue
					
					yield p
				}
			}
			
			if (!mustExpand)
				break
		}
	}
}