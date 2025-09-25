"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import {
  getSetsQuery,
  getProductTypesQuery,
  getProductSearchQuery,
} from "@/features/catalog/api";
import { ChecklistFilter } from "@/shared/components/ChecklistFilter";
import { PRODUCT_TYPES } from "@/features/catalog/constants";
import { DisplayCardGrid } from "@/features/catalog/components/DisplayCardGrid";
import { DisplayCardProps } from "@/features/catalog/components/DisplayCard";

const SET_ERA_MAP: Record<string, string> = {
  // Scarlet & Violet Era
  "067820d9-ab4f-7744-8000-e423d2e2ae7e": "Scarlet & Violet", // SV01: Scarlet & Violet Base Set
  "067820d9-a961-7a3f-8000-c4fd4aec32c7": "Scarlet & Violet", // SV02: Paldea Evolved
  "067820d9-a879-72d1-8000-3f97ce09441b": "Scarlet & Violet", // SV03: Obsidian Flames
  "067820d9-a3df-717b-8000-aa8553e98fdf": "Scarlet & Violet", // SV04: Paradox Rift
  "067820d9-a103-7211-8000-906bae167f1e": "Scarlet & Violet", // SV05: Temporal Forces
  "067820d9-a01b-7dd7-8000-bb56fa81f94f": "Scarlet & Violet", // SV06: Twilight Masquerade
  "067820d9-9c81-74e7-8000-1aa6c5798f84": "Scarlet & Violet", // SV07: Stellar Crown
  "067820d9-9b97-7abb-8000-9094ef6f6a2f": "Scarlet & Violet", // SV08: Surging Sparks
  "06786ed6-d75d-7f47-8000-187dbeab905e": "Scarlet & Violet", // SV09: Journey Together
  "067e8e23-b888-7872-8000-2410f28eb2d8": "Scarlet & Violet", // SV10: Destined Rivals
  "068302bb-4376-7af1-8000-df8dfec8bbff": "Scarlet & Violet", // SV: Black Bolt
  "068302bb-43d9-745a-8000-614780ab883d": "Scarlet & Violet", // SV: White Flare
  "067820d9-a1f0-76c4-8000-67041e757d70": "Scarlet & Violet", // SV: Paldean Fates
  "067820d9-9ab8-7077-8000-eb86a13fee5d": "Scarlet & Violet", // SV: Prismatic Evolutions
  "067820d9-a5b7-7bf1-8000-bd857e433f2c": "Scarlet & Violet", // SV: Scarlet & Violet 151
  "067820d9-aa51-7b82-8000-3badb49ebf56": "Scarlet & Violet", // SV: Scarlet & Violet Promo Cards
  "067820d9-9e43-7dab-8000-260f709f8021": "Scarlet & Violet", // SV: Shrouded Fable
  "0688096c-5d2a-739d-8000-9bce63a42b79": "Scarlet & Violet", // SVE: Scarlet & Violet Energies

  // Sword & Shield Era
  "067820db-973f-792f-8000-8bb86e05aa27": "Sword & Shield", // SWSH01: Sword & Shield Base Set
  "067820db-90b6-71ed-8000-3f7fadd938ae": "Sword & Shield", // SWSH02: Rebel Clash
  "067820db-79a4-7cd7-8000-f50f00c7bf4b": "Sword & Shield", // SWSH03: Darkness Ablaze
  "067820db-412e-7d13-8000-ae8bfeb5d251": "Sword & Shield", // SWSH04: Vivid Voltage
  "067820db-2a01-7637-8000-92243dce11ca": "Sword & Shield", // SWSH05: Battle Styles
  "067820db-23f3-7892-8000-f967d15399b0": "Sword & Shield", // SWSH06: Chilling Reign
  "067820db-2115-7d4e-8000-bb5a556726ce": "Sword & Shield", // SWSH07: Evolving Skies
  "067820db-1a75-76ea-8000-958c6387e6d3": "Sword & Shield", // SWSH08: Fusion Strike
  "067820db-0b7e-7260-8000-f51df7b3817e": "Sword & Shield", // SWSH09: Brilliant Stars
  "067820db-17c8-752b-8000-7ef9066bae3b": "Sword & Shield", // SWSH09: Brilliant Stars Trainer Gallery
  "067820da-e74f-7d9f-8000-10cc1c699b17": "Sword & Shield", // SWSH10: Astral Radiance
  "067820da-fa00-7c62-8000-cfbb28fe8a38": "Sword & Shield", // SWSH10: Astral Radiance Trainer Gallery
  "067820da-55ca-7a43-8000-4b3cc6f888b5": "Sword & Shield", // SWSH11: Lost Origin
  "067820da-8bfc-7d78-8000-2fc8ccf2f21f": "Sword & Shield", // SWSH11: Lost Origin Trainer Gallery
  "067820da-4996-7787-8000-f94c130ec42e": "Sword & Shield", // SWSH12: Silver Tempest
  "067820da-517c-73c5-8000-490dd16e6755": "Sword & Shield", // SWSH12: Silver Tempest Trainer Gallery
  "067820db-a3ad-7fb5-8000-4894aead21af": "Sword & Shield", // SWSH: Sword & Shield Promo Cards
  "067820db-2c9a-7b7d-8000-026450bffe39": "Sword & Shield", // First Partner Pack
  "067820db-1cfc-7a31-8000-bc9ad47893b9": "Sword & Shield", // Celebrations
  "067820db-1fa9-7b38-8000-4b8600c1b6bf": "Sword & Shield", // Celebrations: Classic Collection
  "067820db-6560-7642-8000-e989c6276320": "Sword & Shield", // Champion's Path
  "067820db-2f18-7676-8000-361306ef2735": "Sword & Shield", // Shining Fates
  "067820db-319e-70a4-8000-f6e2cca1f896": "Sword & Shield", // Shining Fates: Shiny Vault
  "067820d9-c1c9-7363-8000-bd5021e88b46": "Sword & Shield", // Crown Zenith
  "067820d9-c8f7-7ae5-8000-43c38c05247a": "Sword & Shield", // Crown Zenith: Galarian Gallery
  "067820da-b9f0-765f-8000-72d485fd6618": "Sword & Shield", // Pokemon GO
  "067820d9-a2f0-7a2c-8000-776a147617fb": "Sword & Shield", // Trading Card Game Classic
  "067820da-a042-758d-8000-85e6c08604e4": "Sword & Shield", // Trick or Trade BOOster Bundle
  "067820d9-a795-7ebf-8000-d782e5181ec9": "Sword & Shield", // Trick or Trade BOOster Bundle 2023
  "067820d9-9d5f-76db-8000-4b2cfb029576": "Sword & Shield", // Trick or Trade BOOster Bundle 2024
  "067820db-38b9-7f44-8000-72bbbf940f35": "Sword & Shield", // McDonald's 25th Anniversary Promos
  "067820da-adb4-7267-8000-32adb00f03be": "Sword & Shield", // McDonald's Promos 2022
  "067820d9-a699-7ff4-8000-d7b478e5bc46": "Sword & Shield", // McDonald's Promos 2023
  "067931e6-466a-79d1-8000-71419124984c": "Sword & Shield", // McDonald's Promos 2024
  "067820db-8c94-7fdf-8000-22cb8e962421": "Sword & Shield", // Battle Academy
  "067820db-015e-7236-8000-d5aa96d6f818": "Sword & Shield", // Battle Academy 2022
  "067820d9-9f27-705c-8000-709358673194": "Sword & Shield", // Battle Academy 2024

  // Sun & Moon Era
  "067820dc-ed98-7f0c-8000-9e4cca0da352": "Sun & Moon", // SM Base Set
  "067820dc-d3e6-7890-8000-e66922fd32bc": "Sun & Moon", // SM - Burning Shadows
  "067820dc-69be-7707-8000-1a7b575fddde": "Sun & Moon", // SM - Celestial Storm
  "067820db-a7e7-78f2-8000-41e1df2c9f71": "Sun & Moon", // SM - Cosmic Eclipse
  "067820dc-972d-7e00-8000-9cb618163d85": "Sun & Moon", // SM - Crimson Invasion
  "067820dc-6f01-7c4f-8000-63e0bad51c26": "Sun & Moon", // SM - Forbidden Light
  "067820dc-df59-71ab-8000-dcb68d7f2f73": "Sun & Moon", // SM - Guardians Rising
  "067820dc-23aa-7077-8000-bad9f6750b3a": "Sun & Moon", // SM - Lost Thunder
  "067820dc-1e08-7c82-8000-b89d8ce3b640": "Sun & Moon", // SM - Team Up
  "067820dc-795c-7b79-8000-8f665a4add7d": "Sun & Moon", // SM - Ultra Prism
  "067820dc-1042-7224-8000-ffd8d07e8dac": "Sun & Moon", // SM - Unbroken Bonds
  "067820db-eb6c-7df2-8000-5300886bce86": "Sun & Moon", // SM - Unified Minds
  "067820dd-0359-787c-8000-81ecdfa86e51": "Sun & Moon", // SM Promos
  "067820dc-71ba-7850-8000-b06065e1309c": "Sun & Moon", // SM Trainer Kit: Alolan Sandslash & Alolan Ninetales
  "067820dc-e970-7036-8000-36e58ff5f523": "Sun & Moon", // SM Trainer Kit: Lycanroc & Alolan Raichu
  "067820db-dcf7-733a-8000-71aa6fc6640c": "Sun & Moon", // Hidden Fates
  "067820db-e524-7b66-8000-3b44a607a9ea": "Sun & Moon", // Hidden Fates: Shiny Vault
  "067820dc-6341-7e9a-8000-efaeae69ce5d": "Sun & Moon", // Dragon Majesty
  "067820dc-b864-7638-8000-495e591b585a": "Sun & Moon", // Shining Legends
  "067820dc-1b73-7700-8000-fce38fc7a4d0": "Sun & Moon", // Detective Pikachu
  "067820dc-943a-74f8-8000-6b206c1035de": "Sun & Moon", // McDonald's Promos 2017
  "067820dc-5477-7bf1-8000-0a443be0fff3": "Sun & Moon", // McDonald's Promos 2018
  "067820db-d041-73fd-8000-af9c6e53f363": "Sun & Moon", // McDonald's Promos 2019

  // XY Era
  "067820df-79ca-7e10-8000-60214dbdd8ba": "XY", // XY Base Set
  "067820dd-7404-7b1a-8000-21ef02327980": "XY", // XY - BREAKpoint
  "067820dd-a6bc-7664-8000-c7e5e6d7eef6": "XY", // XY - BREAKthrough
  "067820dd-0a4b-7e94-8000-3e91b367cdde": "XY", // XY - Evolutions
  "067820dd-58fd-7e0d-8000-ad0c94548491": "XY", // XY - Fates Collide
  "067820df-7742-7dad-8000-f64ecaa4ab1f": "XY", // XY - Flashfire
  "067820de-36da-7f07-8000-e733d0fe135e": "XY", // XY - Furious Fists
  "067820de-2f1e-7aee-8000-7aad0c83d5ac": "XY", // XY - Phantom Forces
  "067820de-2761-7fc0-8000-e403ad89ad31": "XY", // XY - Primal Clash
  "067820dd-ac92-7418-8000-c0ada943d139": "XY", // XY - Roaring Skies
  "067820dd-4991-7a75-8000-958142cc0ac7": "XY", // XY - Steam Siege
  "067820df-7b58-784c-8000-2e079ddb3a8f": "XY", // XY Promos
  "067820de-2a0c-70ad-8000-d90335aef847": "XY", // XY Trainer Kit: Bisharp & Wigglytuff
  "067820dd-eb85-7b5b-8000-74bf21720267": "XY", // XY Trainer Kit: Latias & Latios
  "067820dd-5eb1-7fcd-8000-b3bbe2751cef": "XY", // XY Trainer Kit: Pikachu Libre & Suicune
  "067820df-7883-7504-8000-c0d4985a2912": "XY", // XY Trainer Kit: Sylveon & Noivern
  "067820dd-a9df-782b-8000-a25a2056aa38": "XY", // XY - Ancient Origins
  "067820de-1947-78d9-8000-d28bc074988e": "XY", // Double Crisis
  "067820dd-6163-7e4a-8000-a12e9d98ed87": "XY", // Generations
  "067820dd-68cf-7f21-8000-0b61214cd26c": "XY", // Generations: Radiant Collection
  "067820dd-2f69-77bf-8000-1e453b156a13": "XY", // McDonald's Promos 2016
  "067820dd-952d-78b1-8000-9d7b9df549e9": "XY", // McDonald's Promos 2015
  "067820de-3838-7e8e-8000-fdaa84b6c63a": "XY", // McDonald's Promos 2014

  // Black & White Era
  "067820df-f195-7fbb-8000-8954865392bd": "Black & White", // Black and White
  "067820df-fa22-7563-8000-d63a3afd156f": "Black & White", // Black and White Promos
  "067820df-836d-78f4-8000-ebfd95ef70f9": "Black & White", // Boundaries Crossed
  "067820df-8785-7d31-8000-8bd30c3b235e": "Black & White", // Dark Explorers
  "067820df-8593-72f8-8000-a2be3c435691": "Black & White", // Dragons Exalted
  "067820df-8499-7210-8000-6c6e7d777117": "Black & White", // Dragon Vault
  "067820df-8c4e-7ebf-8000-c561b53da3b6": "Black & White", // Emerging Powers
  "067820df-88ee-7f91-8000-946115980a7f": "Black & White", // Next Destinies
  "067820df-8a62-7014-8000-a31d745cf00e": "Black & White", // Noble Victories
  "067820df-8033-769b-8000-ed019fd39d57": "Black & White", // Plasma Blast
  "067820df-812f-75ec-8000-8f4388d28289": "Black & White", // Plasma Freeze
  "067820df-822e-7221-8000-30edfc11be34": "Black & White", // Plasma Storm
  "067820df-7e0c-749b-8000-e61f1d271cb8": "Black & White", // Legendary Treasures
  "067820df-7f38-74db-8000-b90aecf9ecfc": "Black & White", // Legendary Treasures: Radiant Collection
  "067820df-8b60-7afa-8000-cf3fea313a0f": "Black & White", // BW Trainer Kit: Excadrill & Zoroark
  "067820df-8d65-7daf-8000-a46df53d4031": "Black & White", // McDonald's Promos 2011
  "067820df-8689-782c-8000-a170f49b43e4": "Black & White", // McDonald's Promos 2012
  "067820df-7c8e-7df6-8000-49d1510c5a34": "Black & White", // Kalos Starter Set

  // Call of Legends Era
  "067820e0-008c-7f39-8000-d609afe9b95c": "Call of Legends", // Call of Legends

  // HeartGold SoulSilver Era
  "067820e0-47f1-712f-8000-052a6a4de60c": "HeartGold SoulSilver", // HeartGold SoulSilver
  "067820e0-4dd5-7336-8000-2e2f48c4cff7": "HeartGold SoulSilver", // HGSS Promos
  "067820e0-2d94-7a0a-8000-ed36626d144a": "HeartGold SoulSilver", // HGSS Trainer Kit: Gyarados & Raichu
  "067820e0-0b94-7a6e-8000-a02f41e011c4": "HeartGold SoulSilver", // Triumphant
  "067820e0-1418-7783-8000-bceb6a3a7c2c": "HeartGold SoulSilver", // Undaunted
  "067820e0-3b9c-76f3-8000-c74453f52e4a": "HeartGold SoulSilver", // Unleashed

  // Platinum Era
  "067820e0-9e18-718c-8000-a653eef31302": "Platinum", // Platinum
  "067820e0-7693-7719-8000-3b65f0631091": "Platinum", // Rising Rivals
  "067820e0-5e70-7a80-8000-a536fb688659": "Platinum", // Supreme Victors
  "067820e0-5282-784d-8000-0ade74c5e8f7": "Platinum", // Arceus
  "067820e0-5054-751f-8000-9683581281e0": "Platinum", // Rumble
  "067820e0-1697-74f7-8000-7ea4a33db234": "Platinum", // Pikachu World Collection Promos
  "067820e0-a44f-75b1-8000-dbb0ead394d1": "Platinum", // Legends Awakened
  "067820e0-a6a5-7109-8000-ace458db1176": "Platinum", // Majestic Dawn
  "067820e0-afd6-7766-8000-2413cc8b624e": "Platinum", // Great Encounters
  "067820e0-a07f-77df-8000-6131ba5d9090": "Platinum", // Stormfront
  "067820e0-b241-7e25-8000-f84bd1591822": "Platinum", // Secret Wonders
  "067820e0-dc41-755d-8000-50d04bff1d79": "Platinum", // Mysterious Treasures
  "067820e0-e2d9-744a-8000-6337d11027c0": "Platinum", // Diamond and Pearl
  "067820e0-e8fd-74f1-8000-c4c4316a6700": "Platinum", // Diamond and Pearl Promos
  "067820e0-b568-749c-8000-11dce55bed51": "Platinum", // DP Training Kit 1 Blue
  "067820e0-b90c-775c-8000-12ed6e58fa98": "Platinum", // DP Training Kit 1 Gold
  "067820e0-bb9c-71f8-8000-125c9a2b37e2": "Platinum", // DP Trainer Kit: Manaphy & Lucario
  "067820e0-0608-7f86-8000-ea5cf77c2274": "Platinum", // Professor Program Promos
  "067820e0-a2ef-7123-8000-39b78965920b": "Platinum", // Countdown Calendar Promos
  "067820e0-817c-7621-8000-3e6332a8ca31": "Platinum", // Burger King Promos

  // Diamond & Pearl Era
  "067820e0-ea4b-73b3-8000-bb41e3298477": "Diamond & Pearl", // Power Keepers

  // EX Ruby & Sapphire Era
  "067820e1-a6dd-7e9c-8000-97f0f23f0b13": "EX Ruby & Sapphire", // Ruby and Sapphire
  "067820e1-9daa-77bd-8000-8d1ab6e67e22": "EX Ruby & Sapphire", // Sandstorm
  "067820e1-8cb5-7bd5-8000-4ba040143721": "EX Ruby & Sapphire", // Hidden Legends
  "067820e1-6f35-744b-8000-f22d9bf3b0dd": "EX Ruby & Sapphire", // FireRed & LeafGreen
  "067820e1-9093-7868-8000-d40bd4c6da78": "EX Ruby & Sapphire", // Team Magma vs Team Aqua
  "067820e1-577b-7517-8000-a0a7d1408e12": "EX Ruby & Sapphire", // Deoxys
  "067820e1-4317-75c0-8000-7960a75e3188": "EX Ruby & Sapphire", // Emerald
  "067820e0-fbc9-77d8-8000-96a2443c932a": "EX Ruby & Sapphire", // Delta Species
  "067820e1-1c8f-700e-8000-b65e2a7638b8": "EX Ruby & Sapphire", // Unseen Forces
  "067820e0-f74e-7e39-8000-d514b7905a6b": "EX Ruby & Sapphire", // Legend Maker
  "067820e0-f198-7f81-8000-71cb7e7031ed": "EX Ruby & Sapphire", // Holon Phantoms
  "067820e0-ec96-766a-8000-893e41f3ecb5": "EX Ruby & Sapphire", // Dragon Frontiers
  "067820e0-f050-702e-8000-3f13b4deeede": "EX Ruby & Sapphire", // Crystal Guardians
  "067820e1-5a07-7485-8000-2d87eecc1162": "EX Ruby & Sapphire", // Team Rocket Returns
  "067820e1-67f4-76aa-8000-d532113c93a2": "EX Ruby & Sapphire", // EX Battle Stadium
  "067820e1-70a3-7f35-8000-0bd750e1cba4": "EX Ruby & Sapphire", // Kids WB Promos
  "067820e1-ba13-7c36-8000-ac496d0f0f12": "EX Ruby & Sapphire", // Expedition
  "067820e1-9535-7d03-8000-94e08b408ecc": "EX Ruby & Sapphire", // Dragon
  "067820e1-a933-7a9b-8000-c1d8941a0731": "EX Ruby & Sapphire", // Skyridge

  // e-Card Era
  "067820e1-acc2-7b1f-8000-75219c11468d": "e-Card", // Aquapolis

  // Legendary Collection Era
  "067820e1-c18a-702b-8000-ee40ccfd3f9f": "Legendary Collection", // Legendary Collection

  // Neo Era
  "067820e2-7c5b-779d-8000-f235b0d4b082": "Neo", // Neo Genesis
  "067820e2-4fca-7ff6-8000-91d7dc86b992": "Neo", // Neo Discovery
  "067820e2-2bba-7cf7-8000-8740e2efbe6e": "Neo", // Neo Revelation
  "067820e2-21ab-7cd7-8000-17fa56e686f2": "Neo", // Neo Destiny
  "067820e2-4838-7822-8000-e4d8d53b08ef": "Neo", // Southern Islands

  // Gym Era
  "067820e2-a0ce-7df6-8000-72a4a11aa2c0": "Gym", // Gym Heroes
  "067820e2-8064-7367-8000-62a94b0156b1": "Gym", // Gym Challenge

  // Base Era
  "067820e2-ec1e-7364-8000-0948a94fbbb8": "Base", // Base Set
  "067820e2-aaf4-799d-8000-f1cf42bec9c2": "Base", // Base Set 2
  "067820e3-0c86-7f36-8000-c512177e4d57": "Base", // Base Set (Shadowless)
  "067820e2-e474-74e5-8000-985b810d78a1": "Base", // Jungle
  "067820e2-bc13-7532-8000-0e2e97ab896b": "Base", // Fossil
  "067820e2-a359-7e73-8000-9159aaf125e8": "Base", // Team Rocket
  "067820e2-c627-7eb6-8000-3d90c8242a99": "Base", // WoTC Promo
  "067820e3-103d-705a-8000-649fd38b0ffb": "Base", // Blister Exclusives
  "067820e3-35b6-7bf4-8000-4053bf7757b8": "Base", // EX Trainer Kit 1: Latias & Latios
  "067820e3-384e-7e06-8000-f33d839caace": "Base", // EX Trainer Kit 2: Plusle & Minun
  "067820e3-39c3-7cd1-8000-c5faed46d654": "Base", // Nintendo Promos
  "067820e3-3c3e-7f17-8000-49336b2734a5": "Base", // POP Series 1
  "067820e3-4277-7835-8000-88df09ceef17": "Base", // POP Series 2
  "067820e3-484d-721b-8000-0cf2dc293c0e": "Base", // POP Series 3
  "067820e3-4cb2-7074-8000-d4d5e533e103": "Base", // POP Series 4
  "067820e3-5213-76b4-8000-d27fc47ca9ae": "Base", // POP Series 5
  "067820e3-8451-7255-8000-89c6aadc5ec6": "Base", // POP Series 6
  "067820e3-8ae0-74c0-8000-d8dde5feb581": "Base", // POP Series 7
  "067820e3-97cc-7fbf-8000-eb169aa455d2": "Base", // POP Series 8
  "067820e3-9c92-7f6e-8000-dc0a1d79df03": "Base", // POP Series 9
  "067820e1-b1b0-7e5e-8000-1180f180db0e": "Base", // Best of Promos
  "067820dc-d7a3-7da2-8000-f19f577377b3": "Base", // Alternate Art Promos
  "067820dc-e6d6-78e8-8000-64e404870a6f": "Base", // Ash vs Team Rocket Deck Kit (JP Exclusive)
  "067820dd-133b-7cb1-8000-e1aa55d31ada": "Base", // Deck Exclusives
  "067820dd-fc08-7bfc-8000-569acc517169": "Base", // Jumbo Cards
  "067820dd-5607-7a7c-8000-132a62dee881": "Base", // League & Championship Cards
  "067820dc-61e1-75ca-8000-92f71f8668f4": "Base", // Miscellaneous Cards & Products
  "067820d9-a4cd-721b-8000-c0325a7965d2": "Base", // My First Battle
  "067820da-28c2-7edb-8000-0be85c7817f1": "Base", // Prize Pack Series Cards
  "067820dc-6c6d-7ea8-8000-733f873ea092": "Base", // World Championship Decks
  "06879ff4-9d41-746d-8000-0196dd8358b5": "Mega Evolution", // ME01: Mega Evolution
};

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(
    []
  );

  const {
    data: setsData,
    error: setsError,
    isLoading: setsLoading,
  } = useQuery(getSetsQuery());

  const {
    data: productTypesData,
    error: productTypesError,
    isLoading: productTypesLoading,
  } = useQuery(getProductTypesQuery());

  const {
    data: searchResults,
    error: searchError,
    isLoading: searchLoading,
  } = useQuery({
    ...getProductSearchQuery({
      query: searchQuery,
      productType:
        selectedProductTypes.length === 1 ? selectedProductTypes[0] : undefined,
      setId: selectedSets.length === 1 ? selectedSets[0] : undefined,
    }),
  });

  if (setsLoading || productTypesLoading) {
    return <div>Loading filters...</div>;
  }

  if (setsError || productTypesError) {
    return (
      <div>
        Error loading data: {setsError?.message || productTypesError?.message}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <Separator className="mb-6" />

      <div className="mb-6">
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Search for products (optional)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <h2 className="text-lg font-semibold mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Sets</h3>
              {selectedSets.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedSets.length} of {setsData?.sets.length || 0} selected
                </span>
              )}
            </div>
            <ChecklistFilter
              options={
                setsData?.sets.map((set) => ({
                  id: set.id,
                  name: set.name,
                  era: SET_ERA_MAP[set.id] || "Other",
                  release_date: set.release_date,
                })) || []
              }
              selectedValues={selectedSets}
              onSelectionChange={setSelectedSets}
              placeholder="Select sets..."
              searchPlaceholder="Search sets..."
              groupBy="era"
              sortBy="release_date"
              sortOrder="desc"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Product Types</h3>
              {selectedProductTypes.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedProductTypes.length} of{" "}
                  {productTypesData?.product_types.length || 0} selected
                </span>
              )}
            </div>
            <ChecklistFilter
              options={
                productTypesData?.product_types.map((type) => ({
                  id: type,
                  name: PRODUCT_TYPES[type],
                })) || []
              }
              selectedValues={selectedProductTypes}
              onSelectionChange={setSelectedProductTypes}
              placeholder="Select product types..."
              searchPlaceholder="Search product types..."
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          Search Results
          {searchResults && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({searchResults.total} results)
            </span>
          )}
        </h2>

        {searchLoading && <div>Searching...</div>}

        {searchError && (
          <div className="text-red-500">
            Error searching: {searchError.message}
          </div>
        )}

        {searchResults && (
          <DisplayCardGrid
            cards={searchResults.results.map(
              (product): DisplayCardProps => ({
                decisionId: product.id, // Using product ID as decision ID
                productId: product.id,
                name: product.name,
                number: product.number,
                image_url: product.image_url,
                set: {
                  name: product.set.name,
                  id: product.set.id,
                },
                price: product.skus[0]?.lowest_listing_price_total || 0, // Use first SKU's price or 0
              })
            )}
            isLoading={searchLoading}
          />
        )}
      </div>
    </div>
  );
}
