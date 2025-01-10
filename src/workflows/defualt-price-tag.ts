import { CreatePriceSetDTO } from "@medusajs/framework/types";
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { createPriceSetsStep, } from "@medusajs/medusa/core-flows";

const createBasePriceFormTagRulesId = 'create-base-price-form-tag-rules'

const createBasePriceFormTagRules = createWorkflow(
    createBasePriceFormTagRulesId,
    function (input: CreatePriceSetDTO[]) {
        const priceStepDTOs = createPriceSetsStep(input);
        return new WorkflowResponse(priceStepDTOs)
    }
)

export default createBasePriceFormTagRules