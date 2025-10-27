import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, Home as HomeIcon } from "lucide-react";

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

  const buyerResults = calculateBuyer();
  const investorResults = calculateInvestor();

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buyer" className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4" />
              Home Buyer
            </TabsTrigger>
            <TabsTrigger value="investor" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Investor
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
        </Tabs>
      </div>
    </div>
  );
}
