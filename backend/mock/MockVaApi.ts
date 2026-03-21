export class MockVaApi {
  async getMock() {
    return { mock: true, source: 'MockVaApi.ts' };
  }
}
