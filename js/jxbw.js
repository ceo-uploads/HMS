(() => {
	'use strict';

	const SAMPLE_RATE = 32;

	function popcount(value) {
		value -= (value >>> 1) & 0x55555555;
		value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
		return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
	}

	function stableCountingSort(indices, keyFor, maxKey) {
		const counts = new Uint32Array(maxKey + 1);
		for (const index of indices) counts[keyFor(index)]++;
		let offset = 0;
		for (let key = 0; key < counts.length; key++) {
			const count = counts[key];
			counts[key] = offset;
			offset += count;
		}
		const sorted = new Uint32Array(indices.length);
		for (const index of indices) sorted[counts[keyFor(index)]++] = index;
		return sorted;
	}

	function suffixArray(symbols) {
		const length = symbols.length;
		const alphabet = [...new Set(symbols)].sort((left, right) => left - right);
		const alphabetRank = new Map(alphabet.map((symbol, index) => [symbol, index]));
		let ranks = Uint32Array.from(symbols, symbol => alphabetRank.get(symbol));
		let classes = alphabet.length;
		let suffixes = Uint32Array.from({ length }, (_value, index) => index);

		for (let span = 1; span < length && classes < length; span *= 2) {
			suffixes = stableCountingSort(suffixes, index => index + span < length ? ranks[index + span] + 1 : 0, classes);
			suffixes = stableCountingSort(suffixes, index => ranks[index] + 1, classes);
			const nextRanks = new Uint32Array(length);
			let nextClass = 0;
			let previousFirst = -1;
			let previousSecond = -1;
			for (const index of suffixes) {
				const first = ranks[index];
				const second = index + span < length ? ranks[index + span] : -1;
				if (first !== previousFirst || second !== previousSecond) {
					if (previousFirst !== -1) nextClass++;
					previousFirst = first;
					previousSecond = second;
				}
				nextRanks[index] = nextClass;
			}
			ranks = nextRanks;
			classes = nextClass + 1;
		}
		return suffixes;
	}

	class WaveletMatrix {
		constructor(values, maxValue) {
			this.length = values.length;
			this.levels = Math.max(1, Math.ceil(Math.log2(maxValue + 1)));
			this.bitvectors = [];
			this.prefixOnes = [];
			this.zeroCounts = [];
			let current = values;
			for (let level = this.levels - 1; level >= 0; level--) {
				const bits = new Uint32Array(Math.ceil(current.length / 32));
				const zeros = [];
				const ones = [];
				for (let index = 0; index < current.length; index++) {
					if ((current[index] >>> level) & 1) {
						bits[index >>> 5] |= 1 << (index & 31);
						ones.push(current[index]);
					} else zeros.push(current[index]);
				}
				const prefix = new Uint32Array(bits.length + 1);
				for (let word = 0; word < bits.length; word++) prefix[word + 1] = prefix[word] + popcount(bits[word]);
				this.bitvectors.push(bits);
				this.prefixOnes.push(prefix);
				this.zeroCounts.push(zeros.length);
				current = Uint32Array.from([...zeros, ...ones]);
			}
		}

		rankOnes(levelIndex, end) {
			const bits = this.bitvectors[levelIndex];
			const prefix = this.prefixOnes[levelIndex];
			const word = end >>> 5;
			const remaining = end & 31;
			if (!remaining) return prefix[word];
			const mask = 0xffffffff >>> (32 - remaining);
			return prefix[word] + popcount(bits[word] & mask);
		}

		rank(value, end) {
			let left = 0;
			let right = end;
			for (let index = 0; index < this.levels; index++) {
				const level = this.levels - index - 1;
				const onesLeft = this.rankOnes(index, left);
				const onesRight = this.rankOnes(index, right);
				if ((value >>> level) & 1) {
					left = this.zeroCounts[index] + onesLeft;
					right = this.zeroCounts[index] + onesRight;
				} else {
					left -= onesLeft;
					right -= onesRight;
				}
			}
			return right - left;
		}
	}

	function build(entries) {
		const documents = [];
		const symbols = [];
		for (const [item, text] of entries) {
			const start = symbols.length;
			for (const character of text) symbols.push(character.codePointAt(0) + 2);
			documents.push({ item, text, start, end: symbols.length });
			symbols.push(1);
		}
		symbols.push(0);
		const textSymbols = Uint32Array.from(symbols);
		const suffixes = suffixArray(textSymbols);
		const bwt = new Uint32Array(suffixes.length);
		const samples = new Map();
		for (let row = 0; row < suffixes.length; row++) {
			const position = suffixes[row];
			bwt[row] = textSymbols[position === 0 ? textSymbols.length - 1 : position - 1];
			if (position % SAMPLE_RATE === 0) samples.set(row, position);
		}
		const frequencies = new Map();
		for (const symbol of bwt) frequencies.set(symbol, (frequencies.get(symbol) || 0) + 1);
		const first = new Map();
		let total = 0;
		for (const symbol of [...frequencies.keys()].sort((left, right) => left - right)) {
			first.set(symbol, total);
			total += frequencies.get(symbol);
		}
		const wavelet = new WaveletMatrix(bwt, Math.max(...frequencies.keys()));

		function locate(row) {
			let steps = 0;
			while (!samples.has(row)) {
				const symbol = bwt[row];
				row = first.get(symbol) + wavelet.rank(symbol, row);
				steps++;
			}
			return (samples.get(row) + steps) % textSymbols.length;
		}

		function documentAt(position) {
			let low = 0;
			let high = documents.length - 1;
			while (low <= high) {
				const middle = (low + high) >>> 1;
				const document = documents[middle];
				if (position < document.start) high = middle - 1;
				else if (position >= document.end) low = middle + 1;
				else return document;
			}
			return null;
		}

		return {
			matches(query) {
				const pattern = Array.from(query.toLowerCase(), character => character.codePointAt(0) + 2);
				let left = 0;
				let right = bwt.length;
				for (let index = pattern.length - 1; index >= 0 && left < right; index--) {
					const symbol = pattern[index];
					const offset = first.get(symbol);
					if (offset === undefined) return new Set();
					left = offset + wavelet.rank(symbol, left);
					right = offset + wavelet.rank(symbol, right);
				}
				const results = new Set();
				for (let row = left; row < right; row++) {
					const document = documentAt(locate(row));
					if (document && document.text.includes(query.toLowerCase())) results.add(document.item);
				}
				return results;
			}
		};
	}

	const api = { build };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	if (typeof window !== 'undefined') window.JXBW = api;
})();