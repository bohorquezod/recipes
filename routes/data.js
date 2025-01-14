const express = require('express')
const router = express.Router()

const config = require('../js/config')
const crypto = require('../js/crypto')
const localDB = require('../js/localDB')
const util = require('../js/util')
const ingredient = require('../js/ingredient')

const REQUEST_TIMEOUT_MS = 500

var validRequest = (req) => {
	return req.body !== undefined && req.body !== null
}

var searchDB = (term, searchOptions, results, findFunc) =>
	new Promise((resolve, _) => {
		findFunc(term, searchOptions)
			.then((dbResults) => {
				for (let dbResult of dbResults) {
					let stored = (recipe) => recipe.title == dbResult.title
					// Don't add to results if it's already there
					if (!results.some(stored)) {
						results.push(dbResult)
					}
				}

				resolve(results)
			})
		setTimeout(resolve, REQUEST_TIMEOUT_MS, results)
	})


// Receive delete request
router.delete('/', (req, res) => {
	if (req.query.title && localDB.delete(req.query.title)) {
		res.status(200)
	} else {
		res.status(404)
	}
})


// Get pantry
router.get('/pantry', (req, res) => {
	localDB.getPantry()
		.then(data => {
			res.status(200).json(data)
		})
		.catch(msg => console.log(msg))
})


// Add pantry item
router.post('/add/ingredient', (req, res) => {
	const _ingredient = ingredient.create(req.query)

	if ( _ingredient) {
		localDB.addIngredient(_ingredient)
			.then(() => {
				res.status(200)
			})
			.catch(msg => {
				console.log('Tried adding ' + _ingredient.name + ' with error '
					+ msg)
				res.status(404)
			})
	}
	res.status(400)
})


// Receive add request
router.post('/add', (req, res) => {
	if (!validRequest(req)) return

	if (!(req.body.hasOwnProperty('recipes')
			&& Array.isArray(req.body.recipes)
			&& req.body.recipes.every(recipe => util.isValidRecipe(recipe)))) {
		res.status(304).json({})
		return
	}

	localDB.add(req.body.recipes)
		.then(() => res.status(200).json({}))
		.catch(msg => {
			console.log('Tried adding ' + req.body.recipes + ' with error '
				+ msg)

			res.status(304).json({})
		})
})


// Receive search request
router.post('/', (req, res) => {
	if (!validRequest(req)) {
		res.status(400).json({})
		return
	}

	var term = req.body.term
	var searchOptions = req.body.options

	Promise.resolve([])
		// Search local
		.then((results) => searchDB(term, searchOptions, results, localDB.find))
		.then((results) => res.status(200).json(results))
})

router.get('/recipe/:name', (req, res) => {
	const name = req.params.name
	const opts = {
		title: true,
		exact: true,
	}
	localDB.find(name, opts)
		.then(data => {
			const ret = data.length > 0 ? data[0] : {}
			res.status(200).json(ret)
		})
		.catch(msg => {
			console.log(msg)
			res.status(500)
		})
})

router.post('/recipe/edit', (req, res) => {
	if (!(req.body.hasOwnProperty('recipes')
			&& Array.isArray(req.body.recipes)
			&& req.body.recipes.every(recipe => util.isValidRecipe(recipe)))) {
		res.status(304).json({})
		return
	}

	localDB.update(req.body.recipes)
		.then(() => res.status(200).json({}))
		.catch(msg => {
			console.log(msg)
			res.status(304).json({})
		})
})

router.get('/profile/createAllowed', (req, res) => {
	res.status(200).json({
		'allowed': config.options.allowAccountCreation
	})
})

router.post('/profile/create', (req, res, next) => {
	if (!config.options.allowAccountCreation) {
		return res.status(405).json({})
	}

	crypto.hash(req.body.password)
		.then(hash => {
			let user = {
				username: req.body.username,
				password: hash
			}

			localDB.addUser(user)
				.then((success) => {
					if (success) {
						req.login(user, (err) => {
							if (err) return next(err)

							res.status(200).json({})
						})
					} else {
						res.status(400).json({})
					}
				})
				.catch((err) => {
					console.log(err)
					res.status(500).json({})
				})
		})
		.catch(msg => {
			console.log(msg)
			return res.status(500).json({})
		})
})

router.get('/profile/logout', function(req, res) {
	req.logout()
	res.status(200).json({})
})

module.exports = router
