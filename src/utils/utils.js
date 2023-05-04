"use strict";
/**
 * Takes a number as input and returns the base 16 logarithm of that number.
 * */
function log16(x) {
    return Math.log(x) / Math.log(16);
}
/**
 * Takes a string as input and returns a boolean indicating whether that string represents a number. 
 * It checks each character in the string to see if it is a digit (0-9).
 * 
 * */
function isNumber(str) {
    return str.split("").every(char => "0123456789".includes(char));
}

/**
 * Takes a string as input and returns a boolean indicating whether that string can be converted 
 * to a BigInt without throwing an error.
 * 
 * */
function bigIntable(str) {
    try {
        BigInt(str);

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Takes a string as input and attempts to parse it as JSON. If parsing succeeds, it returns the 
 * parsed JSON object. If parsing fails, it returns an empty object.
 * */
function parseJSON(value) {
    let parsed;
    
    try {
        parsed = JSON.parse(value);
    } catch (e) {
        return {};
    }

    return parsed;
}

/**
 * Takes an array of transaction objects as input and returns an array of strings, where each string 
 * represents a transaction object with its index in the input array appended to the beginning. 
 * It does this by mapping over the input array and using JSON.stringify() to convert each transaction 
 * object to a string.
 * 
 * */
function indexTxns(transactions) {
    return transactions.map((txn, index) => index.toString() + JSON.stringify(txn));
}

module.exports = { log16, isNumber, parseJSON, bigIntable, indexTxns };
