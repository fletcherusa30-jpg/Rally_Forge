function Get-FutureValue {
    param(
        [double] \,
        [double] \,
        [int] \
    )

    if (\ -eq 0) { return \ * \ }

    \ = [math]::Pow((1 + \), \)
    \ = \ * ((\ - 1) / \)
    return [math]::Round(\, 2)
}
