"use strict";
/**
 * Calculates base 16 log of a number.
 * */
function log16(x) {
    return Math.log(x) / Math.log(16);
}
/**
 * Checks if a string represents a number; if each character is a digit (0-9).
 * */
function isNumber(str) {
    return str.split("").every(char => "0123456789".includes(char));
}
/**
 * Checks if a string can be converted to a BigInt without throwing an error.
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
 * Parses as string as JSON object.
 * */
function parseJSON(value) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return {};
    }
}

/**
 * Converts an array of transaction objects to an array of string representation of 
 * a transaction object & its index in the array appended to the beginning. 
 * 
 * */
function indexTxns(transactions) {
    return transactions.map((txn, index) => index.toString() + JSON.stringify(txn));
}

module.exports = { log16, isNumber, parseJSON, bigIntable, indexTxns };
