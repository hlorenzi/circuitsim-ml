export function debounce(func, wait, immediate)
{
	let timeout = null
	
	return function()
	{
		let context = this
		let args = arguments
		let later = function()
		{
			timeout = null
			if (!immediate)
				func.apply(context, args)
		}
		let callNow = immediate && !timeout
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
		if (callNow)
			func.apply(context, args)
	}
}


export function shuffleArray(array)
{
    for (let i = array.length - 1; i > 0; i--)
	{
        const j = Math.floor(Math.random() * (i + 1))
		const temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
}


export function encodeOneHot(index, length)
{
	let oneHot = new Array(length).fill(0)
	oneHot[index] = 1
	return oneHot
}


export function decodeOneHot(oneHot)
{
	return oneHot.findIndex(i => i != 0)
}