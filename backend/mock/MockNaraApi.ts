export class MockNaraApi {
  async getMock() {
    return { mock: true, source: 'MockNaraApi.ts' };
  }
}
