'use strict';
// FahOS — Local-First WhatsApp & Phone Contacts Manager
// Maps friendly contact names ("Akka", "Agasthya", "Mom") to official phone numbers.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let contactsFilePath = null;

function getContactsPath() {
  if (contactsFilePath) return contactsFilePath;
  try {
    const userData = app ? app.getPath('userData') : path.join(process.env.APPDATA || '', 'FahOS');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    contactsFilePath = path.join(userData, 'fahos_contacts.json');
  } catch (e) {
    contactsFilePath = path.join(__dirname, '..', '..', 'fahos_contacts.json');
  }
  return contactsFilePath;
}

function loadContacts() {
  const p = getContactsPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[FahOS Contacts] Notice reading contacts:', e.message);
  }
  return {};
}

function saveContacts(contactsObj) {
  const p = getContactsPath();
  try {
    fs.writeFileSync(p, JSON.stringify(contactsObj, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn('[FahOS Contacts] Notice saving contacts:', e.message);
    return false;
  }
}

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function normalizePhone(phone) {
  // Strip spaces, dashes, parentheses
  let cleaned = String(phone || '').replace(/[\s\-\(\)]/g, '').trim();
  // If starts with +, remove + for WhatsApp deep link protocol (e.g. +91987 -> 91987)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  // If 10-digit Indian number without country code, add 91
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

function getPhoneForContact(name) {
  const contacts = loadContacts();
  const key = normalizeName(name);

  if (contacts[key]) {
    return contacts[key];
  }

  // Partial search if exact not found
  for (const [k, val] of Object.entries(contacts)) {
    if (k.includes(key) || key.includes(k)) {
      return val;
    }
  }

  return null;
}

function saveContact(name, phone, email = '') {
  const contacts = loadContacts();
  const key = normalizeName(name);
  const formattedPhone = phone ? normalizePhone(phone) : '';
  const formattedEmail = String(email || '').trim().toLowerCase();
  contacts[key] = {
    displayName: name.trim(),
    phone: formattedPhone,
    email: formattedEmail
  };
  saveContacts(contacts);
  return { displayName: name.trim(), name: name.trim(), phone: formattedPhone, email: formattedEmail };
}

function deleteContact(name) {
  const contacts = loadContacts();
  const target = normalizeName(name);
  let foundKey = null;

  for (const k of Object.keys(contacts)) {
    if (k === target || normalizeName(contacts[k].displayName) === target) {
      foundKey = k;
      break;
    }
  }

  if (foundKey) {
    delete contacts[foundKey];
    saveContacts(contacts);
    console.log(`[FahOS Contacts] Deleted contact: "${name}" (key: "${foundKey}")`);
    return true;
  }
  return false;
}

function getAllContacts() {
  const contacts = loadContacts();
  return Object.values(contacts);
}

module.exports = {
  loadContacts,
  saveContact,
  deleteContact,
  getPhoneForContact,
  getAllContacts,
  normalizePhone
};
