"""
Entitlement Engine - VA Benefits Calculation
Calculates projected monthly compensation based on disability ratings
Includes dependents, special programs (SMC, CRSC, TDIU), and annual increases
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CompensationBreakdown:
    """Detailed compensation breakdown"""
    base_compensation: float
    dependent_allowance: float
    smc_amount: float
    total_monthly: float
    total_annual: float
    special_programs: List[str]
    notes: List[str]


class EntitlementEngine:
    """
    Calculates VA disability compensation and special benefits
    Based on 2024 VA compensation rates (38 CFR 3.10)
    """
    
    # 2024 VA Disability Compensation Rates (monthly)
    # https://www.va.gov/disability/compensation-rates/veteran-rates/
    COMPENSATION_RATES_2024 = {
        10: {'veteran_alone': 171.23, 'with_spouse': 171.23},
        20: {'veteran_alone': 338.49, 'with_spouse': 338.49},
        30: {'veteran_alone': 524.31, 'with_spouse': 586.31},
        40: {'veteran_alone': 755.28, 'with_spouse': 839.28},
        50: {'veteran_alone': 1075.16, 'with_spouse': 1179.16},
        60: {'veteran_alone': 1361.88, 'with_spouse': 1486.88},
        70: {'veteran_alone': 1716.28, 'with_spouse': 1861.28},
        80: {'veteran_alone': 1995.01, 'with_spouse': 2161.01},
        90: {'veteran_alone': 2241.91, 'with_spouse': 2428.91},
        100: {'veteran_alone': 3737.85, 'with_spouse': 3946.25}
    }
    
    # Child allowances (added to base rate)
    CHILD_RATES = {
        30: 31.00,    # per child at 30%
        40: 42.00,    # per child at 40%
        50: 52.00,    # per child at 50%
        60: 62.00,    # per child at 60%
        70: 73.00,    # per child at 70%
        80: 83.00,    # per child at 80%
        90: 93.00,    # per child at 90%
        100: 104.00   # per child at 100%
    }
    
    # Dependent parent allowances
    PARENT_RATES = {
        30: {'one_parent': 45.00, 'two_parents': 77.00},
        40: {'one_parent': 60.00, 'two_parents': 103.00},
        50: {'one_parent': 74.00, 'two_parents': 129.00},
        60: {'one_parent': 89.00, 'two_parents': 155.00},
        70: {'one_parent': 104.00, 'two_parents': 180.00},
        80: {'one_parent': 118.00, 'two_parents': 206.00},
        90: {'one_parent': 133.00, 'two_parents': 232.00},
        100: {'one_parent': 148.00, 'two_parents': 257.00}
    }
    
    # Special Monthly Compensation (SMC) - 38 CFR 3.350
    SMC_RATES = {
        'SMC-K': 129.90,      # Loss of creative organ
        'SMC-L': 4768.55,     # Loss of one foot or hand
        'SMC-M': 5249.44,     # Loss of paired extremities
        'SMC-N': 5942.55,     # Helplessness requiring aid
        'SMC-O': 7100.47,     # Aid and attendance
        'SMC-R': 4142.89,     # Special aid and attendance (housebound)
        'SMC-S': 3737.85      # Housebound (baseline 100%)
    }
    
    def calculate_compensation(self, 
                              combined_rating: int,
                              has_spouse: bool = False,
                              num_children: int = 0,
                              num_dependent_parents: int = 0,
                              smc_eligible: List[str] = None) -> CompensationBreakdown:
        """
        Calculate total monthly VA compensation
        
        Args:
            combined_rating: Combined disability rating (0-100, rounded to 10)
            has_spouse: Veteran has spouse
            num_children: Number of dependent children under 18
            num_dependent_parents: Number of dependent parents (0-2)
            smc_eligible: List of SMC categories (e.g., ['SMC-K', 'SMC-S'])
        
        Returns:
            CompensationBreakdown with full details
        """
        if smc_eligible is None:
            smc_eligible = []
        
        # Round rating to nearest 10
        rating = int(round(combined_rating / 10) * 10)
        rating = max(0, min(100, rating))  # Clamp to 0-100
        
        # Get base rate
        if rating < 10:
            base = 0
        else:
            rate_table = self.COMPENSATION_RATES_2024[rating]
            base = rate_table['with_spouse'] if has_spouse else rate_table['veteran_alone']
        
        # Calculate dependent allowances
        dependent_total = 0
        notes = []
        
        # Children
        if num_children > 0 and rating >= 30:
            child_rate = self.CHILD_RATES.get(rating, 0)
            dependent_total += child_rate * num_children
            notes.append(f"{num_children} child(ren): +${child_rate * num_children:.2f}/month")
        elif num_children > 0 and rating < 30:
            notes.append("Child allowances require 30% rating or higher")
        
        # Dependent parents
        if num_dependent_parents > 0 and rating >= 30:
            parent_rates = self.PARENT_RATES.get(rating, {})
            if num_dependent_parents == 1:
                parent_allowance = parent_rates.get('one_parent', 0)
                dependent_total += parent_allowance
                notes.append(f"1 dependent parent: +${parent_allowance:.2f}/month")
            elif num_dependent_parents >= 2:
                parent_allowance = parent_rates.get('two_parents', 0)
                dependent_total += parent_allowance
                notes.append(f"2 dependent parents: +${parent_allowance:.2f}/month")
        
        # Special Monthly Compensation
        smc_total = 0
        special_programs = []
        
        for smc_type in smc_eligible:
            if smc_type in self.SMC_RATES:
                smc_amount = self.SMC_RATES[smc_type]
                smc_total += smc_amount
                special_programs.append(smc_type)
                notes.append(f"{smc_type}: +${smc_amount:.2f}/month")
        
        # Calculate totals
        total_monthly = base + dependent_total + smc_total
        total_annual = total_monthly * 12
        
        return CompensationBreakdown(
            base_compensation=base,
            dependent_allowance=dependent_total,
            smc_amount=smc_total,
            total_monthly=total_monthly,
            total_annual=total_annual,
            special_programs=special_programs,
            notes=notes
        )
    
    def calculate_tdiu_benefit(self) -> Dict[str, Any]:
        """
        Calculate TDIU (Total Disability Individual Unemployability) benefit
        TDIU pays at 100% rate even if combined rating is less
        
        Eligibility:
        - One condition rated 60%+, OR
        - Multiple conditions totaling 70%+ with one at 40%+
        - Unable to maintain substantially gainful employment
        """
        rate_100 = self.COMPENSATION_RATES_2024[100]['veteran_alone']
        
        return {
            'program': 'TDIU',
            'monthly_amount': rate_100,
            'annual_amount': rate_100 * 12,
            'eligibility_requirements': [
                'One condition rated 60% or higher, OR',
                'Combined rating 70%+ with one condition 40%+',
                'Unable to work due to service-connected disabilities',
                'Must file VA Form 21-8940'
            ],
            'notes': [
                'TDIU provides 100% compensation without requiring 100% rating',
                'Can work part-time earning below poverty threshold',
                'Medical evidence of unemployability required'
            ]
        }
    
    def calculate_crsc_benefit(self, va_rating: int, retirement_pay: float) -> Dict[str, Any]:
        """
        Calculate CRSC (Combat-Related Special Compensation)
        Allows concurrent receipt of VA compensation and military retirement
        
        Args:
            va_rating: VA disability rating (10-100)
            retirement_pay: Monthly military retirement pay
        
        Returns:
            CRSC benefit details
        """
        # CRSC restores VA waiver amount
        va_compensation = self.COMPENSATION_RATES_2024.get(va_rating, {}).get('veteran_alone', 0)
        
        # Typically, CRSC = VA compensation amount (restoring the waiver)
        crsc_amount = va_compensation
        
        return {
            'program': 'CRSC',
            'monthly_amount': crsc_amount,
            'annual_amount': crsc_amount * 12,
            'total_with_retirement': retirement_pay + crsc_amount,
            'eligibility_requirements': [
                'Retired from military service',
                'Combat-related disability rating',
                'Must apply through branch of service',
                'Requires 20+ years service OR medical retirement'
            ],
            'notes': [
                'Allows concurrent receipt of retirement pay and VA compensation',
                'Only combat-related disabilities qualify',
                'Must choose between CRSC and CRDP'
            ]
        }
    
    def calculate_lifetime_value(self, monthly_amount: float, 
                                 veteran_age: int = 40,
                                 cola_rate: float = 0.025) -> Dict[str, Any]:
        """
        Calculate lifetime value of VA compensation
        
        Args:
            monthly_amount: Current monthly compensation
            veteran_age: Veteran's current age
            cola_rate: Annual cost of living adjustment (default 2.5%)
        
        Returns:
            Lifetime projections
        """
        life_expectancy = 78  # Average US male life expectancy
        years_remaining = max(1, life_expectancy - veteran_age)
        
        # Calculate with COLA increases
        total_lifetime = 0
        current_monthly = monthly_amount
        
        for year in range(years_remaining):
            annual_amount = current_monthly * 12
            total_lifetime += annual_amount
            current_monthly *= (1 + cola_rate)  # Apply COLA
        
        return {
            'current_monthly': monthly_amount,
            'current_annual': monthly_amount * 12,
            'years_of_payments': years_remaining,
            'lifetime_total': total_lifetime,
            'lifetime_total_formatted': f"${total_lifetime:,.2f}",
            'assumptions': {
                'life_expectancy': life_expectancy,
                'annual_cola': f"{cola_rate * 100}%",
                'veteran_age': veteran_age
            },
            'notes': [
                'Compensation is tax-free',
                'Rates increase annually with COLA',
                'Dependent changes adjust payments',
                'Payments continue for life'
            ]
        }
    
    def calculate_benefit_comparison(self, current_rating: int, 
                                    projected_rating: int,
                                    has_spouse: bool = False,
                                    num_children: int = 0) -> Dict[str, Any]:
        """
        Compare current vs projected benefits
        
        Returns:
            Comparison showing increase potential
        """
        current = self.calculate_compensation(current_rating, has_spouse, num_children)
        projected = self.calculate_compensation(projected_rating, has_spouse, num_children)
        
        monthly_increase = projected.total_monthly - current.total_monthly
        annual_increase = monthly_increase * 12
        
        # Calculate retroactive pay potential (assumes 1 year claim processing)
        retroactive = monthly_increase * 12
        
        return {
            'current_rating': current_rating,
            'current_monthly': current.total_monthly,
            'current_annual': current.total_annual,
            'projected_rating': projected_rating,
            'projected_monthly': projected.total_monthly,
            'projected_annual': projected.total_annual,
            'monthly_increase': monthly_increase,
            'annual_increase': annual_increase,
            'retroactive_potential': retroactive,
            'first_year_total': annual_increase + retroactive,
            'increase_percentage': ((projected.total_monthly / current.total_monthly - 1) * 100) if current.total_monthly > 0 else 0,
            'notes': [
                f'Increase of ${monthly_increase:.2f}/month (${annual_increase:.2f}/year)',
                f'Potential ${retroactive:.2f} retroactive pay for 12-month claim period',
                'Retroactive pay is tax-free lump sum',
                'Effective date is date VA received claim'
            ]
        }
    
    def to_dict(self, comp: CompensationBreakdown) -> Dict:
        """Convert compensation breakdown to dictionary"""
        return {
            'base_compensation': comp.base_compensation,
            'dependent_allowance': comp.dependent_allowance,
            'smc_amount': comp.smc_amount,
            'total_monthly': comp.total_monthly,
            'total_annual': comp.total_annual,
            'special_programs': comp.special_programs,
            'breakdown_notes': comp.notes
        }


if __name__ == '__main__':
    # Test the entitlement engine
    engine = EntitlementEngine()
    
    # Test 1: Basic compensation
    comp = engine.calculate_compensation(
        combined_rating=90,
        has_spouse=True,
        num_children=2,
        smc_eligible=['SMC-K']
    )
    print(f"90% with spouse + 2 kids + SMC-K:")
    print(f"  Monthly: ${comp.total_monthly:.2f}")
    print(f"  Annual: ${comp.total_annual:.2f}")
    print(f"  Notes: {comp.notes}")
    
    # Test 2: Benefit comparison
    comparison = engine.calculate_benefit_comparison(
        current_rating=30,
        projected_rating=70,
        has_spouse=True
    )
    import json
    print("\nBenefit Comparison (30% → 70%):")
    print(json.dumps(comparison, indent=2))
    
    # Test 3: Lifetime value
    lifetime = engine.calculate_lifetime_value(
        monthly_amount=comp.total_monthly,
        veteran_age=35
    )
    print(f"\nLifetime Value: {lifetime['lifetime_total_formatted']}")
    
    # Test 4: TDIU
    tdiu = engine.calculate_tdiu_benefit()
    print(f"\nTDIU Monthly: ${tdiu['monthly_amount']:.2f}")

    Returns:
        JSON string containing theory, nexus logic, CFR refs, etc.
    """

    model = model or AI_MODEL

    # Check if OpenAI API is configured
    if not OPENAI_API_KEY:
        return generate_fallback_theory(prompt)

    try:
        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a VA disability claims education specialist with deep knowledge of Title 38 CFR. You provide educational theories of entitlement grounded in VA regulations. You always return valid JSON responses."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            response_format={"type": "json_object"}  # Ensures JSON response (GPT-4 Turbo+)
        )

        # Extract response
        ai_response = response.choices[0].message.content

        # Validate JSON
        try:
            json.loads(ai_response)
            return ai_response
        except json.JSONDecodeError:
            # If not valid JSON, wrap it
            return json.dumps({
                "theory": ai_response,
                "nexusLogic": "See theory text above",
                "cfrReferences": ["38 CFR § 3.303 - Principles relating to service connection"],
                "medicalRationale": "Consult with medical professional for specific rationale",
                "suggestedEvidence": ["Medical records", "Nexus letter", "Lay statements"]
            })

    except Exception as e:
        print(f"Error calling AI API: {str(e)}")
        return generate_fallback_theory(prompt)


def generate_fallback_theory(prompt: str) -> str:
    """
    Generate a basic theory when AI is unavailable.

    This extracts key information from the prompt and generates
    a template-based response.
    """

    # Extract condition name and type from prompt
    condition_name = "the denied condition"
    connection_type = "service connection"

    try:
        if "Condition Name:" in prompt:
            condition_name = prompt.split("Condition Name:")[1].split("\n")[0].strip()
        if "Connection Type Sought:" in prompt:
            connection_type = prompt.split("Connection Type Sought:")[1].split("\n")[0].strip().lower()
    except:
        pass

    # Generate template response based on connection type
    if "secondary" in connection_type:
        theory = f"""
Theory of Entitlement for {condition_name} - Secondary Service Connection

Under 38 CFR § 3.310(a), a disability that is proximately due to or the result of a service-connected disease or injury shall be service connected. To establish secondary service connection, you must demonstrate:

1. A current diagnosed disability ({condition_name})
2. Evidence of a service-connected disability (your existing conditions)
3. Medical evidence (nexus) establishing that the current disability was caused by or aggravated by the service-connected disability

For {condition_name}, the theory of entitlement would focus on establishing the medical causal relationship between this condition and your existing service-connected disabilities. This typically requires:

- A nexus letter from a qualified medical provider explaining how your service-connected condition(s) caused or aggravated {condition_name}
- Medical records documenting the progression and relationship
- Lay statements describing your experience of symptoms

The VA must consider the theory of entitlement even if you don't explicitly claim secondary service connection, as long as the evidence raises this possibility.
        """

        nexus_logic = """- Current diagnosis of the denied condition
- Existing service-connected condition(s) documented
- Medical literature supports causal relationship
- Timeline shows condition developed after service-connected disability
- Symptoms are consistent with secondary causation"""

        cfr_refs = [
            "38 CFR § 3.310(a) - Secondary service connection",
            "38 CFR § 3.303 - Principles relating to service connection",
            "38 CFR § 4.1 - Essentials of evaluative rating"
        ]

        rationale = f"Medical literature and VA patterns demonstrate that {condition_name} can develop as a secondary consequence of other service-connected disabilities. A qualified medical opinion should evaluate the specific causal relationship in your case."

    elif "presumptive" in connection_type:
        theory = f"""
Theory of Entitlement for {condition_name} - Presumptive Service Connection

Under 38 CFR § 3.307-3.309, certain conditions are presumed to be service-connected when they manifest to a compensable degree within specific timeframes or based on specific service locations/exposures.

For {condition_name}, you should investigate whether:

1. The condition is on a presumptive list (Agent Orange, Gulf War, PACT Act, etc.)
2. You served in the qualifying location or time period
3. The condition manifested within the required timeframe (often 1 year from discharge for chronic conditions)

Common presumptive categories:
- Agent Orange (Vietnam, Thailand, Korean DMZ): Specific cancers, diabetes, Parkinson's, etc.
- Gulf War: Medically unexplained chronic multisymptom illnesses
- PACT Act: Burn pit and toxic exposure conditions
- Chronic diseases within 1 year of discharge

If your condition and service history match a presumptive category, you are not required to prove a direct nexus—the VA must presume service connection.
        """

        nexus_logic = """- Verify condition is on applicable presumptive list
- Confirm service in qualifying location/time period
- Document manifestation within required timeframe
- No direct nexus evidence required (presumption applies)
- VA has burden to rebut presumption"""

        cfr_refs = [
            "38 CFR § 3.307 - Presumptive service connection, general",
            "38 CFR § 3.309 - Disease subject to presumptive service connection",
            "38 CFR § 3.317 - Compensation for certain disabilities due to undiagnosed illnesses (Gulf War)",
            "38 CFR § 3.320 - Claims based on exposure to fine particulate matter"
        ]

        rationale = f"If {condition_name} qualifies under a presumptive service connection regulation, the VA must legally presume the condition is service-connected without requiring direct proof of in-service causation."

    else:  # Direct service connection
        theory = f"""
Theory of Entitlement for {condition_name} - Direct Service Connection

Under 38 CFR § 3.303(a), service connection may be granted for disability resulting from disease or injury incurred in or aggravated by active service. To establish direct service connection, you must demonstrate:

1. A current diagnosed disability ({condition_name})
2. Evidence of in-service occurrence or aggravation of the disease/injury
3. A medical nexus linking the current disability to the in-service event or disease

For {condition_name}, your theory of entitlement should focus on:

In-Service Evidence:
- Service medical records documenting the condition or symptoms
- Incident reports or records of injury/exposure
- Buddy statements from fellow service members
- Service personnel records showing relevant duties/exposures

Continuity of Symptoms:
- Medical records showing ongoing treatment since service (or explanation for gap)
- Lay statements describing continuous symptoms
- VA exam reports documenting chronic nature

Nexus:
- Medical opinion linking current condition to service
- Medical literature supporting the connection
- Temporal relationship (symptoms began during/shortly after service)
        """

        nexus_logic = """- Current medical diagnosis of the condition
- Service medical records or incident reports
- Timeline supports in-service origin
- Continuous symptoms or medical explanation for latency
- Medical opinion supporting service connection"""

        cfr_refs = [
            "38 CFR § 3.303 - Principles relating to service connection",
            "38 CFR § 3.304 - Direct service connection; wartime and peacetime",
            "38 CFR § 3.102 - Reasonable doubt"
        ]

        rationale = f"Direct service connection for {condition_name} requires establishing that the condition originated during military service or was directly caused by an event that occurred during service. Medical and lay evidence should work together to tell a coherent story of service origin."

    # Build JSON response
    response = {
        "theory": theory.strip(),
        "nexusLogic": nexus_logic.strip(),
        "cfrReferences": cfr_refs,
        "medicalRationale": rationale,
        "suggestedEvidence": [
            "Service medical records (STRs)",
            "Service personnel records",
            "VA medical records and exam reports",
            "Private medical records and treatment history",
            "Nexus letter/Independent Medical Opinion (IMO)",
            "Lay statements from veteran, family, and service colleagues",
            "Medical literature supporting the claimed connection"
        ]
    }

    return json.dumps(response, indent=2)


# Example usage and testing
if __name__ == "__main__":
    # Test prompt
    test_prompt = """You are a VA disability claims education specialist. Generate an educational theory of entitlement for the following denied VA disability claim.

DENIED CONDITION INFORMATION:
- Condition Name: Sleep Apnea
- Connection Type Sought: SECONDARY
- Description: Obstructive sleep apnea diagnosed in 2023, causing excessive daytime fatigue and requiring CPAP machine
- Service History: No diagnosis during service, but developed years after discharge

CONNECTION TYPE GUIDANCE:
Secondary service connection requires medical evidence (nexus) showing the denied condition is caused or aggravated by an already service-connected disability (38 CFR § 3.310).

QUESTIONNAIRE RESPONSES:
- Diagnosed during service: No
- Ongoing symptoms: Yes
- Mentioned in VA exams: Yes
- Believed to be secondary: Yes
- Related to: PTSD (70%)

CURRENT SERVICE-CONNECTED CONDITIONS:
- PTSD (Rating: 70%)
- Lower Back Pain (Rating: 40%)

TASK: Generate theory following the template..."""

    result = generate_entitlement_theory(test_prompt)
    print("Generated Theory:")
    print(result)

