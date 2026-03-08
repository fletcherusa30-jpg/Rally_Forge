export const StateBenefitRuleModel = {
    table: 'state_benefits_rules',
    fields: {
        id: 'string',
        state_code: 'string',
        min_rating_percent: 'number',
        requires_combat_flag: 'boolean',
        requires_wartime_service: 'boolean',
        benefit_category: 'string',
        benefit_name: 'string',
        benefit_description: 'string',
        link_or_reference: 'string',
        active: 'boolean'
    }
};

