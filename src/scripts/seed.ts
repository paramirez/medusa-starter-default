import {
  createApiKeysWorkflow,
  createPriceListPricesWorkflow,
  createPriceSetsStep,
  createPriceSetsStepId,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsPriceSetsStep,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateSalesChannelsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import createBasePriceFormTagRules from "src/workflows/defualt-price-tag";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["co"];
  const currency_code = 'cop'

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Canal de ventas - Por Defecto",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateSalesChannelsWorkflow(container).run({
    input: {
      selector: { id: defaultSalesChannel[0].id},
      update: {
        description: 'Canal de ventas por defecto',
        name: 'Canal de ventas - Por Defecto'
      }
    }
  })

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Colombia",
          currency_code: currency_code,
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_region_id: region.id,
        name: 'Deckzter Store',
        supported_currencies: [
          {
            currency_code: currency_code,
            is_tax_inclusive: true,
            is_default: true,
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Tienda fisica",
          address: {
            city: "Bogotá",
            country_code: "CO",
            address_1: "",
          },
          metadata: {
            default: true
          }
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default",
            type: "default",
          },
        ],
      },
    });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Envios por defecto",
    type: "shipping",
    service_zones: [
      {
        name: "Colombia",
        geo_zones: [
          {
            country_code: "co",
            type: "country",
          }
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Envío estandar",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Envío de 2-3 días",
          code: "standard",
        },
        prices: [
          {
            currency_code: currency_code,
            amount: 15000,
          },
          {
            region_id: region.id,
            amount: 15000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      }
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");
  logger.info("Start product tags, and types");
  await productModuleService.createProductTypes({
    value: 'Carta'
  })

  const [a, b, COMMON, UNCOMMON, RARE, MYTHIC] = await productModuleService.createProductTags([
    { value: 'FOIL' },
    { value: 'PROMO' },
    { value: 'COMMON' },
    { value: 'UNCOMMON' },
    { value: 'RARE' },
    { value: 'MYTHIC' },
  ])

  logger.info('End product tags and types')
  logger.info("Start default price set of tags");
  await createBasePriceFormTagRules(container).run({
    input: [
      {
        prices: [
          {
            amount: 4000,
            currency_code,
            rules: {
              tag_id: COMMON.id
            }
          },
          {
            amount: 10000,
            currency_code,
            rules: {
              tag_id: UNCOMMON.id
            }
          },
          {
            amount: 12000,
            currency_code,
            rules: {
              tag_id: RARE.id
            }
          },
          {
            amount: 20000,
            currency_code,
            rules: {
              tag_id: MYTHIC.id
            }
          },
        ]
      }
    ]
  })
  logger.info("End default price set of tags");

}
