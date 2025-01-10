// import { Card } from ".medusa/types/remote-query-entry-points";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows";

import crypto from "crypto";
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils";
import { ExecArgs, ProductCollectionDTO } from "@medusajs/framework/types";

function generateSKU(cardName: string, oracleId: string, collectorNumber: string, set: string): string {

    const initials = cardName
        .split(" ")
        .map(word => word.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2);


    const hash = crypto
        .createHash("sha256")
        .update(`${oracleId}-${collectorNumber}-${set}`)
        .digest("hex")
        .slice(0, 6);

    return `${initials}${hash}`;
}


interface ICard {
    object: string;
    id: string;
    oracle_id: string;
    multiverse_ids: number[];
    mtgo_id: number;
    tcgplayer_id: number;
    name: string;
    lang: string;
    released_at: string;
    uri: string;
    scryfall_uri: string;
    layout: string;
    highres_image: boolean;
    image_status: string;
    image_uris: {
        small: string;
        normal: string;
        large: string;
        png: string;
        art_crop: string;
        border_crop: string;
    };
    mana_cost: string;
    cmc: number;
    type_line: string;
    oracle_text: string;
    power: string;
    toughness: string;
    colors: string[];
    color_identity: string[];
    keywords: string[];
    all_parts: {
        object: string;
        id: string;
        component: string;
        name: string;
        type_line: string;
        uri: string;
    }[];
    legalities: Record<string, "legal" | "not_legal">;
    games: string[];
    reserved: boolean;
    foil: boolean;
    nonfoil: boolean;
    finishes: string[];
    oversized: boolean;
    promo: boolean;
    reprint: boolean;
    variation: boolean;
    set_id: string;
    set: string;
    set_name: string;
    set_type: string;
    set_uri: string;
    set_search_uri: string;
    scryfall_set_uri: string;
    rulings_uri: string;
    prints_search_uri: string;
    collector_number: string;
    digital: boolean;
    rarity: string;
    flavor_text: string;
    card_back_id: string;
    artist: string;
    artist_ids: string[];
    illustration_id: string;
    border_color: string;
    frame: string;
    frame_effects: string[];
    security_stamp: string;
    full_art: boolean;
    textless: boolean;
    booster: boolean;
    story_spotlight: boolean;
    promo_types: string[];
    edhrec_rank: number;
    prices: {
        usd: string | null;
        usd_foil: string | null;
        usd_etched: string | null;
        eur: string | null;
        eur_foil: string | null;
        tix: string | null;
    };
    related_uris: {
        gatherer: string;
        tcgplayer_infinite_articles: string;
        tcgplayer_infinite_decks: string;
        edhrec: string;
    };
    purchase_uris: {
        tcgplayer: string;
        cardmarket: string;
        cardhoarder: string;
    };
    card_faces: {
        image_uris: {
            small: string;
            normal: string;
            large: string;
            png: string;
            art_crop: string;
            border_crop: string;
        }
        name: string,
        type_line: string,
        oracle_text: string
    }[]
}

interface Card {
    oracle_id: string;
    id: string;
    name: string;
    type_line: string;
    oracle_text: string;
    color_identity: string[];
    mana_cost: string;
    cmc: number;
    rarity: string,
    image_url: string;
    set: string;
    set_name: string;
    keywords: string[];
    legalities: Record<string, "legal" | "not_legal">;
    skuParent: string;
    related_uris: {
        gatherer: string;
        edhrec: string;
        [key: string]: string;
    };
}

interface CardVariant {
    sku: string;
    card_oracle_id: string;
    set: string;
    set_name: string;
    collector_number: string;
    promo: boolean;
    finish: string;
    rarity: string;
    price: number;
    release_date: string;
    image_url: string | string[];
}



function getPriceInCOP(
    prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null; eur: string | null; eur_foil: string | null; tix: string | null },
    finish: string,
    exchangeRate: number
): number {
    let priceStr: string | null;


    switch (finish.toLowerCase()) {
        case "foil":
            priceStr = prices.usd_foil;
            break;
        case "etched":
            priceStr = prices.usd_etched;
            break;
        case "nonfoil":
        default:
            priceStr = prices.usd;
    }


    if (priceStr) {
        const priceInCents = Math.round(parseFloat(priceStr) * 100);
        return Math.round(priceInCents * exchangeRate);
    }

    return 0;
}



function generateCardAndVariants(icard: ICard, exchangeRate: number): { card: Card; variants: CardVariant[], finishes: string[], promoTypes: string[] } {
    const skuParent = generateSKU(icard.name, icard.oracle_id, icard.collector_number, icard.set)

    const oracle_text = icard.oracle_text
        || (icard.card_faces?.length
            ? icard.card_faces.reduce((text, cardFace) =>
                text += `${cardFace.name}\n ${cardFace.type_line}\n ${cardFace.oracle_text}\n\n`,
                ``).slice(0, -2)
            : '');

    const card: Card = {
        id: icard.id,
        oracle_id: icard.oracle_id,
        name: icard.name,
        type_line: icard.type_line,
        oracle_text,
        set: icard.set,
        rarity: icard.rarity,
        set_name: icard.set_name,
        color_identity: icard.color_identity,
        mana_cost: icard.mana_cost,
        cmc: icard.cmc,
        image_url: icard.image_uris?.normal || (icard.card_faces?.length ? icard.card_faces.map(cardFace => cardFace.image_uris?.normal ?? '').join(',') : ''),
        keywords: icard.keywords,
        legalities: icard.legalities,
        related_uris: icard.related_uris,
        skuParent
    };


    const promoTypes = icard.promo_types?.length ? icard.promo_types : ["normal"];
    const finishes = icard.finishes?.length ? icard.finishes : ["nonfoil"];


    const variants: CardVariant[] = [];


    finishes.forEach(finish => {
        const sku = `${skuParent}-${icard.set}-${finish.toUpperCase()}-F${icard.collector_number}`.toUpperCase();
        variants.push({
            sku,
            card_oracle_id: icard.oracle_id,
            set: icard.set,
            set_name: icard.set_name,
            collector_number: icard.collector_number,
            promo: !!icard.promo,
            finish,
            rarity: icard.rarity,
            price: getPriceInCOP(icard.prices, finish, exchangeRate),
            release_date: icard.released_at,
            image_url: icard.image_uris?.normal || (icard.card_faces?.length ? icard.card_faces.map(cardFace => cardFace.image_uris?.normal ?? '').join(',') : ''),
        });
    });


    return { card, variants, promoTypes, finishes };
}


async function getCards(urlBase: string): Promise<ICard[]> {
    const cardsScryfall = await fetch(urlBase);
    const cardsScryfallJson = await cardsScryfall.json();

    const { has_more, data, next_page } = cardsScryfallJson;
    if (has_more) return data.concat(await getCards(next_page))
    return data
}

function sanitizeProductHandle(inputString: string): string {

    const lowerCaseString = inputString.toLowerCase();

    const sanitizedString = lowerCaseString.replace(/[^a-z0-9-_]/g, "-");

    const cleanedString = sanitizedString.replace(/-+/g, "-");

    const finalString = cleanedString.replace(/^-|-$/g, "");
    return finalString;
}

// Ejemplo de uso
const input = "Sheoldred, the Apocalypse - STC346CA";
const sanitizedHandle = sanitizeProductHandle(input);
console.log(sanitizedHandle);


export default async function seedDemoData({ container, args }: ExecArgs) {
    if (!args.length) console.log('Collection is required')
    const cardsScryfallJson = await getCards(`https://api.scryfall.com/cards/search?q=${args[0]}+include=extras+game:paper&unique=prints&as=grid&order=released`)
    const cardsScryfall = cardsScryfallJson.map(generateCardAndVariants)

    const productModule = container.resolve('product');
    const salesChannelModule = container.resolve('sales_channel');
    const locationModule = container.resolve('stock_location')
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const salesChannels = await salesChannelModule.listSalesChannels()
    if (!salesChannels.length) return

    const salesChannel = salesChannels[0];

    const [productType] = (await productModule.listProductTypes({
        value: 'Carta'
    }))

    const [location] = await locationModule.listStockLocations({})
    const [foil] = (await productModule.listProductTags({
        value: 'FOIL'
    }))

    const [promo] = (await productModule.listProductTags({
        value: 'PROMO'
    }))
    const rarities = {
        common: (await productModule.listProductTags({
            value: 'COMMON'
        }))[0],
        uncommon: (await productModule.listProductTags({
            value: 'UNCOMMON'
        }))[0],
        rare: (await productModule.listProductTags({
            value: 'RARE'
        }))[0],
        mythic: (await productModule.listProductTags({
            value: 'MYTHIC'
        }))[0],
    }

    for (const { card, variants } of cardsScryfall) {
        const collectionTitle = `MTG-${card.set.toUpperCase()}`
        const collections = await productModule.listProductCollections({
            title: collectionTitle
        })
        let collection: ProductCollectionDTO;

        if (!collections.length) {
            collection = await productModule.createProductCollections({
                title: collectionTitle,
                handle: collectionTitle
            })
        } else collection = collections[0]

        for (const variant of variants) {
            const external_id = `${card.id}_${variant.sku}`
            const products = await productModule.listProducts({
                external_id
            })

            if (!products.length) {

                const isFoil = variant.finish === 'foil'
                const subtitle = variant.promo
                    ? (isFoil ? `${variant.promo} ${foil.value}` : `${variant.promo}`)
                    : (isFoil ? foil.value : '');

                const tagIds = (variant.promo
                    ? (isFoil ? [foil.id, promo.id] : [promo.id])
                    : (isFoil ? [foil.id] : [])).concat(rarities[card.rarity] ? [rarities[card.rarity].id] : []);

                await createProductsWorkflow(container).run({
                    input: {
                        products: [{
                            title: card.name,
                            subtitle: subtitle,
                            tag_ids: tagIds,
                            description: card.oracle_text,
                            handle: sanitizeProductHandle(`${card.name}-${variant.sku}`),
                            status: ProductStatus.PUBLISHED,
                            collection_id: collection.id,
                            images: card.image_url.split(',').map((image, index) => ({
                                url: image,
                            })),
                            type_id: productType.id,
                            external_id,
                            options: [
                                {
                                    title: "finishes",
                                    values: [variant.finish],
                                }
                            ],
                            sales_channels: [{ id: salesChannel.id }],
                            variants: [
                                {
                                    title: `${card.name} ${variant.set.toUpperCase()} ${variant.collector_number.toUpperCase()}`,
                                    sku: variant.sku,
                                    manage_inventory: true,
                                    options: {
                                        finishes: variant.finish,
                                    },
                                }
                            ]
                        }],
                    }
                })

                const { data: inventoryItems } = await query.graph({
                    entity: "inventory_item",
                    fields: ["id", "sku"],
                });


                const inventoryLevels: any[] = [];
                const filteredItems = inventoryItems.filter((item) =>
                    item.sku === variant.sku,
                );

                for (const inventoryItem of filteredItems) {
                    const inventoryLevel = {
                        location_id: location.id,
                        stocked_quantity: 0,
                        inventory_item_id: inventoryItem.id,
                    };
                    inventoryLevels.push(inventoryLevel);
                }

                await createInventoryLevelsWorkflow(container).run({
                    input: {
                        inventory_levels: inventoryLevels,
                    },
                });
                console.log('END', card.name, variant.sku)
            }
        }
    }
}