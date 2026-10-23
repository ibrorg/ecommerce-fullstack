@echo off
echo Running E-commerce Backend Tests...
echo.

echo Running Authentication Tests...
npx jest tests/auth.test.ts --runInBand --forceExit
echo.

echo Running Product Tests...
npx jest tests/product.test.ts --runInBand --forceExit
echo.

echo Running Order Tests...
npx jest tests/order.test.ts --runInBand --forceExit
echo.

echo All tests completed!
pause