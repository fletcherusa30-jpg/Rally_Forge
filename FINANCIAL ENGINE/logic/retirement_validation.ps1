function Validate-RetirementInputs {
    param(
        [double] \,
        [double] \,
        [int] \
    )

    if (\ -lt 0) { throw 'Contribution cannot be negative.' }
    if (\ -lt 0 -or \ -gt 1) { throw 'Rate must be between 0 and 1 (decimal).' }
    if (\ -lt 1 -or \ -gt 100) { throw 'Years must be between 1 and 100.' }

    return \True
}
