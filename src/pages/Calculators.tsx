import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, Home as HomeIcon, Repeat, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

export default function Calculators() {
  // Buyer Calculator State
  const [income, setIncome] = useState(75000);
  const [downPayment, setDownPayment] = useState(50000);
  const [interestRate, setInterestRate] = useState(6.5);
  const [propertyTax, setPropertyTax] = useState(6000);
  const [insurance, setInsurance] = useState(1200);
  const [hoa, setHoa] = useState(0);

  // Investor Calculator State
  const [purchasePrice, setPurchasePrice] = useState(500000);
  const [rehabCost, setRehabCost] = useState(80000);
  const [desiredMargin, setDesiredMargin] = useState(15);
  const [holdingTime, setHoldingTime] = useState(6);
  
  // Rental Calculator State
  const [rentalPrice, setRentalPrice] = useState(300000);
  const [monthlyRent, setMonthlyRent] = useState(2500);
  const [rentalDownPayment, setRentalDownPayment] = useState(60000);
  const [rentalInterestRate, setRentalInterestRate] = useState(7.0);
  const [rentalPropertyTax, setRentalPropertyTax] = useState(4500);
  const [rentalInsurance, setRentalInsurance] = useState(1500);
  const [rentalHoa, setRentalHoa] = useState(100);
  const [maintenance, setMaintenance] = useState(200);
  const [vacancy, setVacancy] = useState(5);
  const [propertyMgmt, setPropertyMgmt] = useState(10);
  
  // BRRRR Calculator State
  const [brrrrPurchase, setBrrrrPurchase] = useState(200000);
  const [brrrrRehab, setBrrrrRehab] = useState(40000);
  const [brrrrArv, setBrrrrArv] = useState(320000);
  const [brrrrRent, setBrrrrRent] = useState(2000);
  const [brrrrLtv, setBrrrrLtv] = useState(75);

  const calculateBuyer = () => {
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = 30 * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    const monthlyTax = propertyTax / 12;
    const monthlyInsurance = insurance / 12;
    const monthlyHoa = hoa / 12;
    
    const totalMonthly = monthlyPayment + monthlyTax + monthlyInsurance + monthlyHoa;
    const dti = (totalMonthly * 12) / income * 100;
    
    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      monthlyTax: monthlyTax.toFixed(2),
      monthlyInsurance: monthlyInsurance.toFixed(2),
      monthlyHoa: monthlyHoa.toFixed(2),
      totalMonthly: totalMonthly.toFixed(2),
      dti: dti.toFixed(1),
    };
  };

  const calculateInvestor = () => {
    const totalCost = purchasePrice + rehabCost;
    const holdingCosts = (purchasePrice * 0.01) * (holdingTime / 12);
    const closingCosts = purchasePrice * 0.03;
    
    const totalInvestment = totalCost + holdingCosts + closingCosts;
    const desiredProfit = totalInvestment * (desiredMargin / 100);
    const arv = totalInvestment + desiredProfit;
    const maxOffer = arv - rehabCost - holdingCosts - closingCosts - desiredProfit;
    
    const roi = ((arv - totalInvestment) / totalInvestment) * 100;
    const cashOnCash = (desiredProfit / downPayment) * 100;
    
    return {
      arv: arv.toFixed(0),
      maxOffer: maxOffer.toFixed(0),
      totalInvestment: totalInvestment.toFixed(0),
      profit: desiredProfit.toFixed(0),
      roi: roi.toFixed(1),
      cashOnCash: cashOnCash.toFixed(1),
    };
  };

  const calculateRental = () => {
    const loanAmount = rentalPrice - rentalDownPayment;
    const monthlyRate = rentalInterestRate / 100 / 12;
    const numberOfPayments = 30 * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    const monthlyTax = rentalPropertyTax / 12;
    const monthlyIns = rentalInsurance / 12;
    const monthlyHoaFee = rentalHoa;
    const vacancyLoss = monthlyRent * (vacancy / 100);
    const mgmtFee = monthlyRent * (propertyMgmt / 100);
    
    const totalExpenses = monthlyPayment + monthlyTax + monthlyIns + monthlyHoaFee + maintenance + vacancyLoss + mgmtFee;
    const netCashFlow = monthlyRent - totalExpenses;
    const capRate = ((monthlyRent * 12 - (monthlyTax + monthlyIns + monthlyHoaFee + maintenance) * 12) / rentalPrice) * 100;
    const cashOnCashReturn = ((netCashFlow * 12) / rentalDownPayment) * 100;
    const onePercentRule = (monthlyRent / rentalPrice) * 100;
    
    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netCashFlow: netCashFlow.toFixed(2),
      annualCashFlow: (netCashFlow * 12).toFixed(2),
      capRate: capRate.toFixed(2),
      cashOnCash: cashOnCashReturn.toFixed(2),
      onePercent: onePercentRule.toFixed(2),
    };
  };

  const calculateBRRRR = () => {
    const totalInvested = brrrrPurchase + brrrrRehab;
    const refinanceAmount = brrrrArv * (brrrrLtv / 100);
    const cashRecovered = refinanceAmount - totalInvested;
    const leftIn = totalInvested - refinanceAmount;
    
    const monthlyRate = 7.0 / 100 / 12;
    const monthlyPayment = refinanceAmount * (monthlyRate * Math.pow(1 + monthlyRate, 360)) / 
                          (Math.pow(1 + monthlyRate, 360) - 1);
    
    const monthlyExpenses = monthlyPayment + 300 + 200 + 150;
    const monthlyCashFlow = brrrrRent - monthlyExpenses;
    const cocReturn = leftIn > 0 ? ((monthlyCashFlow * 12) / leftIn) * 100 : 999;
    
    return {
      totalInvested: totalInvested.toFixed(0),
      refinanceAmount: refinanceAmount.toFixed(0),
      cashRecovered: cashRecovered.toFixed(0),
      leftIn: leftIn > 0 ? leftIn.toFixed(0) : '0',
      monthlyCashFlow: monthlyCashFlow.toFixed(2),
      annualCashFlow: (monthlyCashFlow * 12).toFixed(2),
      cocReturn: cocReturn > 100 ? '∞' : cocReturn.toFixed(1),
      equity: (brrrrArv - refinanceAmount).toFixed(0),
    };
  };

  const buyerResults = calculateBuyer();
  const investorResults = calculateInvestor();
  const rentalResults = calculateRental();
  const brrrrResults = calculateBRRRR();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
            <Calculator className="h-8 w-8 text-primary" />
            Real Estate Calculators
          </h1>
          <p className="text-muted-foreground">
            Analyze affordability and investment potential
          </p>
        </div>

        <Tabs defaultValue="buyer" className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="buyer" className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4" />
              Buyer
            </TabsTrigger>
            <TabsTrigger value="investor" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Flip
            </TabsTrigger>
            <TabsTrigger value="rental" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Rental
            </TabsTrigger>
            <TabsTrigger value="brrrr" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              BRRRR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buyer">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Home Buyer Calculator</CardTitle>
                  <CardDescription>
                    Calculate your monthly mortgage payment and affordability
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Annual Income</Label>
                    <Input
                      type="number"
                      value={income}
                      onChange={(e) => setIncome(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input
                      type="number"
                      value={downPayment}
                      onChange={(e) => setDownPayment(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Annual Property Tax</Label>
                    <Input
                      type="number"
                      value={propertyTax}
                      onChange={(e) => setPropertyTax(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Annual Insurance</Label>
                    <Input
                      type="number"
                      value={insurance}
                      onChange={(e) => setInsurance(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly HOA</Label>
                    <Input
                      type="number"
                      value={hoa}
                      onChange={(e) => setHoa(Number(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Your monthly payment breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Principal & Interest</span>
                      <span className="font-semibold">${buyerResults.monthlyPayment}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Property Tax</span>
                      <span className="font-semibold">${buyerResults.monthlyTax}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Insurance</span>
                      <span className="font-semibold">${buyerResults.monthlyInsurance}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">HOA</span>
                      <span className="font-semibold">${buyerResults.monthlyHoa}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 text-lg">
                      <span className="font-bold">Total Monthly Payment</span>
                      <span className="font-bold text-primary text-2xl">
                        ${buyerResults.totalMonthly}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground">Debt-to-Income Ratio</span>
                      <span className={`font-semibold ${Number(buyerResults.dti) > 43 ? 'text-destructive' : 'text-secondary'}`}>
                        {buyerResults.dti}%
                      </span>
                    </div>
                    {Number(buyerResults.dti) > 43 && (
                      <p className="text-sm text-destructive mt-2">
                        ⚠️ Your DTI is above 43% - you may have difficulty qualifying for a loan
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="investor">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Investor Calculator</CardTitle>
                  <CardDescription>
                    Calculate max offer price and ROI for investment properties
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Rehab Cost</Label>
                    <Input
                      type="number"
                      value={rehabCost}
                      onChange={(e) => setRehabCost(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Desired Profit Margin (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={desiredMargin}
                      onChange={(e) => setDesiredMargin(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Holding Time (months)</Label>
                    <Input
                      type="number"
                      value={holdingTime}
                      onChange={(e) => setHoldingTime(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input
                      type="number"
                      value={downPayment}
                      onChange={(e) => setDownPayment(Number(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Investment Analysis</CardTitle>
                  <CardDescription>Your deal breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">After Repair Value (ARV)</span>
                      <span className="font-semibold">${investorResults.arv}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Maximum Offer Price</span>
                      <span className="font-semibold text-primary">${investorResults.maxOffer}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Total Investment</span>
                      <span className="font-semibold">${investorResults.totalInvestment}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Expected Profit</span>
                      <span className="font-semibold text-secondary">${investorResults.profit}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                      <span className="font-bold">Return on Investment</span>
                      <span className="font-bold text-secondary text-2xl">
                        {investorResults.roi}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground">Cash-on-Cash Return</span>
                      <span className="font-semibold text-secondary">
                        {investorResults.cashOnCash}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rental">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Rental Property Calculator</CardTitle>
                  <CardDescription>
                    Analyze cash flow and returns for rental properties
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={rentalPrice}
                      onChange={(e) => setRentalPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Rent</Label>
                    <Input
                      type="number"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input
                      type="number"
                      value={rentalDownPayment}
                      onChange={(e) => setRentalDownPayment(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={rentalInterestRate}
                      onChange={(e) => setRentalInterestRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Annual Property Tax</Label>
                    <Input
                      type="number"
                      value={rentalPropertyTax}
                      onChange={(e) => setRentalPropertyTax(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Annual Insurance</Label>
                    <Input
                      type="number"
                      value={rentalInsurance}
                      onChange={(e) => setRentalInsurance(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly HOA</Label>
                    <Input
                      type="number"
                      value={rentalHoa}
                      onChange={(e) => setRentalHoa(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Maintenance</Label>
                    <Input
                      type="number"
                      value={maintenance}
                      onChange={(e) => setMaintenance(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vacancy Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={vacancy}
                      onChange={(e) => setVacancy(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Property Management (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={propertyMgmt}
                      onChange={(e) => setPropertyMgmt(Number(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Analysis</CardTitle>
                  <CardDescription>Your rental property breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Monthly Expenses</span>
                      <span className="font-semibold">${rentalResults.totalExpenses}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Net Cash Flow (Monthly)</span>
                      <span className={`font-semibold ${Number(rentalResults.netCashFlow) < 0 ? 'text-destructive' : 'text-secondary'}`}>
                        ${rentalResults.netCashFlow}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Annual Cash Flow</span>
                      <span className={`font-semibold ${Number(rentalResults.annualCashFlow) < 0 ? 'text-destructive' : 'text-secondary'}`}>
                        ${rentalResults.annualCashFlow}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Cap Rate</span>
                      <span className="font-semibold">{rentalResults.capRate}%</span>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                      <span className="font-bold">Cash-on-Cash Return</span>
                      <span className="font-bold text-secondary text-2xl">
                        {rentalResults.cashOnCash}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground">1% Rule Check</span>
                      <span className={`font-semibold ${Number(rentalResults.onePercent) >= 1 ? 'text-secondary' : 'text-muted-foreground'}`}>
                        {rentalResults.onePercent}%
                        {Number(rentalResults.onePercent) >= 1 ? ' ✓' : ' ✗'}
                      </span>
                    </div>
                    {Number(rentalResults.netCashFlow) < 0 && (
                      <p className="text-sm text-destructive mt-2">
                        ⚠️ Negative cash flow - this property may not be a good rental investment
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="brrrr">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>BRRRR Calculator</CardTitle>
                  <CardDescription>
                    Buy, Rehab, Rent, Refinance, Repeat strategy analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={brrrrPurchase}
                      onChange={(e) => setBrrrrPurchase(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rehab Cost</Label>
                    <Input
                      type="number"
                      value={brrrrRehab}
                      onChange={(e) => setBrrrrRehab(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>After Repair Value (ARV)</Label>
                    <Input
                      type="number"
                      value={brrrrArv}
                      onChange={(e) => setBrrrrArv(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Rent</Label>
                    <Input
                      type="number"
                      value={brrrrRent}
                      onChange={(e) => setBrrrrRent(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refinance LTV (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={brrrrLtv}
                      onChange={(e) => setBrrrrLtv(Number(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>BRRRR Strategy Results</CardTitle>
                  <CardDescription>Your wealth-building analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Total Invested</span>
                      <span className="font-semibold">${brrrrResults.totalInvested}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Refinance Amount</span>
                      <span className="font-semibold text-primary">${brrrrResults.refinanceAmount}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Cash Recovered</span>
                      <span className={`font-semibold ${Number(brrrrResults.cashRecovered) > 0 ? 'text-secondary' : 'text-destructive'}`}>
                        ${brrrrResults.cashRecovered}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Capital Left In Deal</span>
                      <span className="font-semibold">${brrrrResults.leftIn}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Monthly Cash Flow</span>
                      <span className="font-semibold text-secondary">${brrrrResults.monthlyCashFlow}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Built-In Equity</span>
                      <span className="font-semibold text-secondary">${brrrrResults.equity}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                      <span className="font-bold">Cash-on-Cash Return</span>
                      <span className="font-bold text-secondary text-2xl">
                        {brrrrResults.cocReturn}%
                      </span>
                    </div>
                    {Number(brrrrResults.cashRecovered) >= Number(brrrrResults.totalInvested) && (
                      <p className="text-sm text-secondary mt-2">
                        ✓ Infinite return! You've recovered all invested capital.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">
            Ready to analyze a specific property?
          </p>
          <Button asChild variant="hero" size="lg">
            <Link to="/deal-analysis">Go to Deal Analysis</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
