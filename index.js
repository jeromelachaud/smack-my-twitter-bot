'use strict';
console.log('') // cleaner

/**
 * Import
 */
const chalk    = require('chalk')
const Twit     = require('twit')
const _        = require('lodash')
const moment   = require('moment')
const compile  = require('bloody-compile')
const settings = require('./settings.json')
const track    = require('./track.json')
const sentence = require('./sentence.json')

/**
 * Functions
 */

/**
 * Returns a random integer between min (included) and max (excluded)
 * Using Math.round() will give you a non-uniform distribution!
 */
const getRandomInt = ( min, max ) => {
  return Math.floor(Math.random() * (max - min)) + min
}

/**
 * What to tweet
 * @param  {object} tweet
 * @param  {string} message
 * @return {void}
 */
const tweetThat = ( tweet, message ) => {

  // do not answer to yourself, buddy.
  if ( tweet.user.screen_name !== username ) {

    const postParam = {
      in_reply_to_status_id: tweet.id_str,
      status: `@${tweet.user.screen_name} ${message}`
    }

    // make it not so much bot
    setTimeout(() => {

      api.post('statuses/update', postParam, ( err, data, response ) => {

        console.log('')
        console.log( chalk.bgBlue( chalk.black('Tweet    —') ), chalk.bgWhite( chalk.black('@' + tweet.user.screen_name ) ) + ' ' + tweet.text )
        console.log( chalk.bgGreen( chalk.black('Answer   —') ), chalk.bgWhite( chalk.black('@' + username ) ) + ' ' + message )
        if ( err ) console.log( chalk.bgRed( chalk.white('Error    —') ) , err )
        console.log('')

      })

    // }, getRandomInt( settings.timeToAnswer.min, settings.timeToAnswer.max ) )
    }, settings.timeToAnswer.max )

  }

}

/**
 * Handle what to answer
 * @param  {string} text          text to check
 * @param  {regex} regex
 * @param  {array} answer         list of answers
 * @param  {object} replacement
 * @return {string|false}
 */
const handleAnswer = ( text, regex, answers, replacement ) => {

  if ( text.search( regex ) >= 0 ) {
    return compile( _.sample( answers ), replacement )
  }

  else {
    return undefined
  }

}

/**
 * Check the text and answer it.
 * @param  {[type]} text
 * @param  {[type]} rules
 * @return {string}
 * ex:
 *   - text = 'hello sa va'
 *   - rules = [
 *      [/[^a-z]nope[^a-z]/ig, ['nope']],
 *      [/[^a-z]sa va[^a-z]/ig, ['pas d\'accord']]
 *    ]
 */
const checkAndAnswer = function( text, rules ) {

  let status = undefined

  let i = 0

  while ( status === undefined ) {

    if ( i == rules.length) break

    var rule = rules[i]

    if ( rule.length === 3 ) {
      status = handleAnswer( text, rule[0], rule[1], rule[2] )
    }
    else {
      status = handleAnswer( text, rule[0], rule[1] )
    }

    i++
  }

  return status

}


/**
 * Definition
 */
const api      = new Twit( settings.twitterKeys )
const username = settings.username

const trackedWords = track
trackedWords.push( username ) // add username to be tracked

const streamParam = {
  track: trackedWords
}

/**
 * Action!
 */
api
  .stream('statuses/filter', streamParam)
  .on('tweet', function( tweet ) {

    // show tweet before being filtered
    // console.log( chalk.bgBlack('Stream   —'), tweet ) // show all tweet


    // blacklisted? do not answer
    if ( _.indexOf( settings.blacklist, tweet.user.screen_name ) >= 0 ) return

    // break RT, do not answer
    if ( typeof tweet.retweeted_status !== 'undefined' ) return

    // if not in whitelist, check some rules first
    if ( _.indexOf( settings.whitelist, tweet.user.screen_name ) < 0 ) {

      // don't care about small accounts
      if ( tweet.user.followers_count < settings.followerLimit ) return

      // don't care about too recent accounts
      if ( settings.yearLimit !== 0 && moment( new Date( tweet.user.created_at ) ).year() > settings.yearLimit ) return

      // don't care about protected accounts
      if ( tweet.user.protected ) return

      // don't care about some languages
      if ( !(tweet.lang === 'fr' || tweet.lang === 'en') ) return

    }

    // show tweet after being filtered
    console.log( chalk.bgBlack('Stream   —'), chalk.bgWhite( chalk.black('@' + tweet.user.screen_name ) ) + ' ' + tweet.text )
    // console.log( chalk.bgBlack('Stream   —'), tweet ) // show all tweet

    let rules = []

    /**
     * Replies
     */
    if ( tweet.in_reply_to_screen_name === username && tweet.user.screen_name !== username ) {

      rules = [
        [/[^a-z]fdp/gi, sentence.fdp],
        [/[^a-z]tg/gi, sentence.offensive.concat(sentence.tg)],
        [/(merci|pardon|désolé|desole)/gi, sentence.thanks],
        [/nike/gi, sentence.nike],
        [/respect/gi, sentence.respect],
        [/(ntm|(nique|niquer) ta (mère|mere))/gi, sentence.mere.concat(sentence.ntm)],
        [/[^a-z](mere|mère)/gi, sentence.mere],
        [/[^a-z](gueule|ballec|blc|foutre|vtf|vtff|chier|couille|couilles)/gi, sentence.offensive], // offensive
        [/[^a-z](robot|robots|bot|bots)/gi, sentence.bot], // bot
        ['', sentence.smalltalk] // if no detection, answer by smalltalk
      ]

    }

    /**
     * Check mistakes
     */
    // do not always answer, just sometimes
    else if ( getRandomInt(0,2) ) {
    // else if ( true ) {

      rules = [
        // [/(ai|as) [a-zA-Z]*er/ig, sentence.mistake.concat(sentence.participePassePremierGroupe), { original: 'er' }],
        [/la faute (a|à|aux)/ig, sentence.fix, { original: 'la faute à', fix: 'la faute de' }],
        // [/autant pour moi/ig, sentence.fix.concat(sentence.autantpourmoi), { original: 'autant pour moi', fix: 'au temps pour moi' }], // http://www.langue-fr.net/spip.php?article14 tl;dr: tolérance
        [/entrain de/ig, sentence.fix.concat(sentence.entrain), { original: 'entrain', fix: 'en train' }],
        [/recrute[\w\s]+stagiaire/ig, sentence.stagiaire, {}],
        [/au (coiffeur|médecin|medecin|pharmacien|notaire|dentiste|garagiste)/ig, sentence.fix, { original: 'au', fix: 'chez' }],
        [/[^a-z]je comprend\W/ig, sentence.fix.concat(sentence.mistake), { original: 'je comprend', fix: 'je comprends' }],
        [/[^a-z]tous le monde\W/ig, sentence.fix.concat(sentence.mistake), { original: 'tous le monde', fix: 'tout le monde' }],
        [/(mille|milles) lieux/ig, sentence.fix.concat(sentence.mistake), { original: 'mille lieux', fix: 'mille lieues' }],
        [/bonne (appetit|appétit)/ig, sentence.fix.concat(sentence.mistake), { original: 'bonne appétit', fix: 'bon appétit' }],
        [/\b[^a-z]voye\b/ig, sentence.mistake, { original: 'voye' }],
        [/\b[^a-z]voyes\b/ig, sentence.mistake, { original: 'voyes' }],
        [/[^a-z](le|du) digital/ig, sentence.digital],
        [/[^a-z]datas/ig, sentence.fix, { original: 'datas', fix: 'data' }],
        [/[^a-z]moi qui a /ig, sentence.fix, { original: 'a', fix: 'ai' }],
        [/[^a-z]moi qui as /ig, sentence.fix, { original: 'as', fix: 'ai' }],
        [/chiffre d\'affaire[^s]/ig, sentence.fix, { original: 'chiffre d\'affaire', fix: 'chiffre d\'affaires' }],
        [/[^a-z]scénarios/ig, sentence.fix, { original: 'scénarios', fix: 'scénarii' }],
        [/[^a-z]quelque soit/ig, sentence.fix, { original: 'quelque soit', fix: 'quel(le)(s) que soi(en)t' }],
        [/[^a-z]parmis/ig, sentence.fix, { original: 'parmis', fix: 'parmi' }],
        [/[^a-z]discution/ig, sentence.fix, { original: 'discution', fix: 'discussion' }],
        [/[^a-z][^a-z]mourrir/ig, sentence.mourrir],
        [/[^a-z]la connection/ig, sentence.fix, { original: 'la connection', fix: 'la connexion' }],
        [/[^a-z]quizz/ig, sentence.fix, { original: 'quizz', fix: 'quiz' }],
        [/j\'ai tord/ig, sentence.fix.concat(sentence.tord), { original: 'j\'ai tord', fix: 'j\'ai tort' }],
        [/[^a-z]tampis/ig, sentence.fix, { original: 'tampis', fix: 'tant pis' }],
        [/(du|le) soucis/ig, sentence.soucis],
        [/[^a-z]ses sa/ig, sentence.soucis, { original: 'ses sa', fix: 'c\'est ça' }],
        [/[^a-z]comme (meme|même)/ig, sentence.fix, { original: 'comme même', fix: 'quand même' }],
        [/[^a-z](fait|faire) sens/ig, sentence.faireSens],
        [/[^a-z]aimerai bien/ig, sentence.fix, { original: 'aimerai bien', fix: 'aimerais bien' }],
        [/bonne anniversaire/ig, sentence.fix, { original: 'bonne anniversaire', fix: 'bon anniversaire' }],
        [/bon année/ig, sentence.fix, { original: 'bon année', fix: 'bonne année' }],
        [/quand (à|a) (lui|toi|vous|elle)/ig, sentence.fix, { original: 'quand à', fix: 'quant à' }],
        [/ai fais/ig, sentence.fix, { original: 'j\'ai fais', fix: 'j\'ai fait' }],
        [/ai dis/ig, sentence.fix, { original: 'j\'ai dis', fix: 'j\'ai dit' }],
        [/acceuil/ig, sentence.fix, { original: 'acceuil', fix: 'accueil' }],
        [/soit disant/ig, sentence.fix, { original: 'soit disant', fix: 'soi-disant' }],
        [/croivent/ig, sentence.croivent],
        [/croive/ig, sentence.croive],
        // [/[^a-z]sa va[^a-z]/ig, sentence.fix, { original: 'sa va', fix: 'ça va' }], // too much
        [/(?!hormis)(\bh?orm(is|i)\b)/ig, sentence.mistake.concat(sentence.ormi), { fix: 'hormis' }], // It would be better to capture the word with regex and set it automatically to original
        [/[^a-z]sh(é|e)ma/ig, sentence.mistake.concat(sentence.fix), { original: 'shéma', fix: 'schéma' }],
        [/[^a-z]sc(é|è)nette/ig, sentence.mistake.concat(sentence.fix), { original: 'scénette', fix: 'saynète' }],
        [/[^a-z]davantages/ig, sentence.fix, { original: 'davantages', fix: 'd\'avantages' }],
        [/tu tris/ig, sentence.fix.concat(sentence.tris), { original: 'tu tris', fix: 'tu tries' }],
        [/[^a-z](le|un|du) magasine/ig, sentence.fix.concat(sentence.magasine), { original: 'magasine', fix: 'magazine' }],
        [/[^a-z](le|un|du) magazin/ig, sentence.fix.concat(sentence.magazin), { original: 'magazin', fix: 'magasin' }],
        [/[\s]cryptage/ig, sentence.fix.concat(sentence.cryptage), { original: 'crytage', fix: 'chiffrement' }],
        [/[\s]crypter/ig, sentence.fix.concat(sentence.cryptage), { original: 'crypter', fix: 'chiffrer' }],
        [/[^a-z](ai|as|a|avons|avez|ont) été chez/ig, sentence.aiété], // Can't really track `été (au|à)` at the moment
        [/sur la bonne voix/ig, sentence.surLaBonneVoix]
      ]
    }

    const answer = checkAndAnswer( tweet.text, rules )

    // tweet if there's something to tweet
    if ( typeof answer !== 'undefined' ) {
      tweetThat( tweet, answer )
    }

  })
