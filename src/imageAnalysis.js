import PointCloud2D from "./pointCloud2d.js"


const searchRadius = 20
const ignoreRadius = 6


function distSqr(x1, y1, x2, y2)
{
	const xDist = x1 - x2
	const yDist = y1 - y2
	return (xDist * xDist + yDist * yDist)
}


export function findRegions(img, thresholdBegin = 0.85, thresholdEnd = 0.5, minArea = 50)
{
	let rects = []
	
	for (let j = 0; j < img.h; j++)
	for (let i = 0; i < img.w; i++)
	{
		let alreadyContained = false
		for (const rect of rects)
		{
			if (i >= rect.xMin && i <= rect.xMax && j >= rect.yMin && j <= rect.yMax)
				alreadyContained = true
		}
		
		if (!alreadyContained && img.get(i, j) > thresholdBegin)
		{
			let rect = { xMin: i, xMax: i, yMin: j, yMax: j }
			let set = new Set()
			findRegionRecurisve(img, set, i, j, (c, x, y) =>
			{
				if (c < thresholdEnd)
					return false
				
				rect.xMin = Math.min(rect.xMin, x)
				rect.xMax = Math.max(rect.xMax, x)
				rect.yMin = Math.min(rect.yMin, y)
				rect.yMax = Math.max(rect.yMax, y)
				return true
			})
			
			if ((rect.xMax - rect.xMin) * (rect.yMax - rect.yMin) > minArea)
				rects.push(rect)
		}
	}
	
	return rects
}


function findRegionRecurisve(img, set, x, y, filterFn)
{
	if (x < 0 || x >= img.w || y < 0 || y >= img.h)
		return
	
	if (set.has(y * img.w + x))
		return
	
	set.add(y * img.w + x)
	
	if (filterFn(img.get(x, y), x, y))
	{
		findRegionRecurisve(img, set, x - 1, y + 0, filterFn)
		findRegionRecurisve(img, set, x + 1, y + 0, filterFn)
		findRegionRecurisve(img, set, x + 0, y - 1, filterFn)
		findRegionRecurisve(img, set, x + 0, y + 1, filterFn)
	}
}


export function findTrails(img, rects)
{
	let trails = []
	
	for (const rect of rects)
	{
		for (let x = rect.xMin; x < rect.xMax; x++)
		{
			findTrailsRecursive(img, rects, trails, x, rect.yMin - 1, x, rect.yMin - 1, true)
			findTrailsRecursive(img, rects, trails, x, rect.yMax + 1, x, rect.yMax + 1, true)
		}
		for (let y = rect.yMin; y < rect.yMax; y++)
		{
			findTrailsRecursive(img, rects, trails, rect.xMin - 1, y, rect.xMin - 1, y, true)
			findTrailsRecursive(img, rects, trails, rect.xMax + 1, y, rect.xMax + 1, y, true)
		}
	}
	
	const trailCloud = new PointCloud2D()
	for (const trail of trails)
		trailCloud.addPoint(trail)
	
	for (const rect of rects)
	{
		const trailU = trailCloud.findNearest((rect.xMin + rect.xMax) / 2, rect.yMin)
		const trailD = trailCloud.findNearest((rect.xMin + rect.xMax) / 2, rect.yMax)
		const trailL = trailCloud.findNearest(rect.xMin, (rect.yMin + rect.yMax) / 2)
		const trailR = trailCloud.findNearest(rect.xMax, (rect.yMin + rect.yMax) / 2)
		
		//console.log(trailU, trailD, trailL, trailR)
		if (trailU) trailU.connected = true
		if (trailD) trailD.connected = true
		if (trailL) trailL.connected = true
		if (trailR) trailR.connected = true
	}
	
	for (let trail of trails)
	{
		trail.links = []
		for (const nextTrail of trailCloud.enumerateNear(trail.x, trail.y, searchRadius))
		{
			if (nextTrail === trail)
				continue
			
			trail.links.push(nextTrail)
		}
	}
	
	trails = filterTopologicallyUsefulTrails(trails)
	
	trails.forEach((trail, i) => { trail.id = i })
	improveTrailLinks(trails)
	
	trails = filterTopologicallyUsefulTrails(trails)
	
	trails.forEach(t => t.links = [...new Set(t.links)])
	
	return trails
}


function improveTrailLinks(trails)
{
	for (let trail of trails)
	{
		//console.log("--")
		//console.log("trail", trail.id)
		
		while (true)
		{
			let hadReconnection = false
			
			for (let nextTrail of [...trail.links])
			{
				const score = (x1, y1, x2, y2) =>
				{
					const straightness = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1))
					const d = distSqr(x1, y1, x2, y2)
					
					return d * (straightness + 1)
				}
				
				//console.log("    > next", nextTrail.id)
				let bestConnection = nextTrail
				for (let nextNextTrail of nextTrail.links)
				{
					if (nextNextTrail === trail || nextNextTrail === nextTrail)
						continue
					
					const nextNextScore = score(trail.x, trail.y, nextNextTrail.x, nextNextTrail.y)
					const bestScore = score(trail.x, trail.y, bestConnection.x, bestConnection.y)
					//console.log("        nextNext", nextNextTrail.id, nextNextScore, bestScore)
					if (nextNextScore < bestScore)
						bestConnection = nextNextTrail
				}
				
				//console.log("    best", bestConnection.id)
				if (bestConnection !== nextTrail)
				{
					nextTrail.links = nextTrail.links.filter(t => t !== trail)
					trail.links = trail.links.filter(t => t !== nextTrail)
					
					bestConnection.links.push(trail)
					trail.links.push(bestConnection)
					
					if (trail.worseLinks)
						trail.worseLinks.push(nextTrail)
					
					//console.log("    better link found")
					hadReconnection = true
				}
			}
			
			if (!hadReconnection)
				break
		}
	}
}


function findTrailsRecursive(img, rects, trails, x, y, prevX, prevY, first)
{
	for (const rect of rects)
	{
		if (x > rect.xMin && x < rect.xMax && y > rect.yMin && y < rect.yMax)
			return
	}
	
	for (const trail of trails)
	{
		const xDist = x - trail.x
		const yDist = y - trail.y
		if (xDist * xDist + yDist * yDist < ignoreRadius * ignoreRadius)
			return
	}
	
	let thisTrail = null
	if (!first)
	{
		thisTrail = { x, y }
		trails.push(thisTrail)
	}
	
	let continuations = []
	for (let yy = Math.max(0, y - searchRadius); yy < Math.min(img.h, y + searchRadius); yy++)
	for (let xx = Math.max(0, x - searchRadius); xx < Math.min(img.w, x + searchRadius); xx++)
	{
		if (distSqr(x, y, xx, yy) > searchRadius * searchRadius)
			continue
		
		if (img.get(xx, yy) > 0.5)
		{
			const xDist = xx - x
			const yDist = yy - y
			continuations.push({ x: xx, y: yy, distSqr: xDist * xDist + yDist * yDist })
		}
	}
	
	continuations.sort((a, b) => b.distSqr - a.distSqr)
	
	for (const continuation of continuations)
		findTrailsRecursive(img, rects, trails, continuation.x, continuation.y, x, y, false)
}


function filterTopologicallyUsefulTrails(trails)
{
	for (let trail of trails)
	{
		trail.connectedLinks = []
		trail.worseLinks = []
	}
	
	const topoSeenTrails = new Set()
	const topoUsefulTrails = new Set()
	for (const trail of trails)
	{
		if (trail.connected)
			filterTopologicallyUsefulTrailsRecursive(trail, true, topoSeenTrails, topoUsefulTrails)
	}
	
	trails = trails.filter(t => t.connected || topoUsefulTrails.has(t))
	for (let trail of trails)
	{
		trail.links = trail.connectedLinks
		trail.links = trail.links.filter(t => t.connected || topoUsefulTrails.has(t))
	}
	
	return trails
}


function filterTopologicallyUsefulTrailsRecursive(trail, isFirst, seenTrails, usefulTrails)
{
	let useful = trail.connected
	if (isFirst || !trail.connected)
	{
		const sortScore = (t) => distSqr(t.x, t.y, trail.x, trail.y)
		
		let sortedTrails = [...trail.links]
		sortedTrails.sort((a, b) => sortScore(a) - sortScore(b))
		
		for (const nextTrail of sortedTrails)
		{
			if (trail.connected && nextTrail.connected)
				continue
			
			if (seenTrails.has(nextTrail))
				continue
			
			seenTrails.add(nextTrail)
			
			const nextUseful = filterTopologicallyUsefulTrailsRecursive(nextTrail, false, seenTrails, usefulTrails)
			if (nextUseful)
			{
				nextTrail.connectedLinks.push(trail)
				trail.connectedLinks.push(nextTrail)
			}
			
			useful |= nextUseful
		}
	}
	
	if (useful)
		usefulTrails.add(trail)
	
	return useful
}


export function segmentTrails(trails)
{
	const seenTrails = new Set()
	const trailToSegmentMap = new Map()
	
	let segments = []
	
	const dirTo = (x1, y1, x2, y2) => Math.atan2(y1 - y2, x2 - x1)
	const mod = (x, m) => (x % m + m) % m
	const angleDiff = (a1, a2) => Math.abs(mod((a2 - a1) + Math.PI, Math.PI * 2) - Math.PI)
	
	function followLineRecursive(segment, trail)
	{
		if (seenTrails.has(trail))
			return
		
		seenTrails.add(trail)
		
		if (segment && segment.trails.length >= 2)
		{
			const firstTrail = segment.trails[0]
			const secondTrail = segment.trails[1]
			const origDir = dirTo(firstTrail.x, firstTrail.y, secondTrail.x, secondTrail.y)
			
			const prevTrail = segment.trails[segment.trails.length - 1]
			const curDir = dirTo(prevTrail.x, prevTrail.y, trail.x, trail.y)
			
			//console.log(firstTrail.id, secondTrail.id, Math.floor(origDir / Math.PI * 180), ",", prevTrail.id, trail.id, Math.floor(curDir / Math.PI * 180), "=", Math.floor(angleDiff(origDir, curDir) / Math.PI * 180))
			
			if (angleDiff(origDir, curDir) > Math.PI / 4)
			{
				segment = null
				//console.log("break segment")
			}
		}
		
		if (!segment)
		{
			segment = { trails: [] }
			segments.push(segment)
		}
		
		segment.trails.push(trail)
		
		for (const link of trail.links)
		{
			if (trail.links.length >= 3)
			{
				segment.trails.push(link)
				followLineRecursive(null, link, trail)
			}
			else
				followLineRecursive(segment, link, trail)
		}
	}
	
	let trailsToProcess = trails.filter(t => t.connected)
	
	while (trailsToProcess.length > 0)
	{
		const trail = trailsToProcess.pop()
		followLineRecursive(null, trail)
	}
	
	return segments
}